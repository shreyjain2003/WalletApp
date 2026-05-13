// AuthDTOs.cs
// Data Transfer Objects (DTOs) for the AuthService API.
// DTOs are the shapes of data that travel over the wire — they are separate
// from the database models so that we can control exactly what fields are
// exposed or accepted without leaking internal implementation details
// (e.g. password hashes, internal IDs, navigation properties).
// All records here use C# record types for immutability and concise syntax.

using System.ComponentModel.DataAnnotations;

namespace AuthService.DTOs;

// ── INBOUND REQUEST DTOs ──────────────────────────────────────────────────

// Payload sent by the client when creating a new account.
// Data annotations are validated automatically by ASP.NET Core's model binder
// before the controller action is even called.
public record RegisterRequest(
    // Full display name — must be at least 3 characters to prevent single-letter names.
    [Required, MinLength(3), MaxLength(80)]
    string FullName,

    // Email used as the login identifier — must be a valid email format.
    [Required, EmailAddress, MaxLength(120)]
    string Email,

    // Indian mobile number — regex enforces 10 digits starting with 6-9.
    [Required, RegularExpression(@"^[6-9]\d{9}$",
        ErrorMessage = "Phone number must be a valid 10-digit mobile number.")]
    string PhoneNumber,

    // Password — regex enforces complexity: upper, lower, digit, special char.
    // MinLength(8) and MaxLength(64) bound the length to prevent trivial and
    // excessively long passwords that could cause BCrypt performance issues.
    [Required,
     MinLength(8),
     MaxLength(64),
     RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,64}$",
         ErrorMessage = "Password must have uppercase, lowercase, number, and special character.")]
    string Password
);

// Payload sent by the client when logging in.
// Intentionally minimal — only the credentials needed to authenticate.
public record LoginRequest(
    [Required, EmailAddress, MaxLength(120)]
    string Email,

    [Required, MaxLength(64)]
    string Password
);

// Payload sent by the client when updating their own profile details.
// Does NOT include password — password changes go through the reset flow.
public record UpdateUserRequest(
    [Required, MinLength(3), MaxLength(80)]
    string FullName,

    [Required, EmailAddress, MaxLength(120)]
    string Email,

    [Required, RegularExpression(@"^[6-9]\d{9}$",
        ErrorMessage = "Phone number must be a valid 10-digit mobile number.")]
    string PhoneNumber
);

// Payload sent when a user submits their KYC identity document for review.
// No validation attributes here because the service layer validates these
// fields and throws AppValidationException with a descriptive message.
public record KycSubmitRequest(
    string DocumentType,   // e.g. "Aadhaar", "PAN", "Passport"
    string DocumentNumber  // The unique number printed on the document
);

// ── OUTBOUND RESPONSE DTOs ────────────────────────────────────────────────

// Returned after a successful login or registration.
// Contains the JWT and the key user fields the frontend needs to
// initialise the session without making a separate profile call.
public record AuthResponse(
    string Token,    // Signed JWT — the frontend stores this and sends it as "Authorization: Bearer ..."
    string UserId,   // String form of the GUID — used by the frontend to identify the current user
    string FullName, // Displayed in the UI header / greeting
    string Email,    // Shown in profile and used for display purposes
    string Role,     // "User" or "Admin" — controls which UI sections are visible
    string Status    // "Pending", "Active", or "Rejected" — controls wallet access
);

// Returned by GET /api/auth/profile and internal user-lookup endpoints.
// Includes the nested KYC status so the frontend can show KYC progress
// without a separate API call.
public record UserProfileResponse(
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string Status,
    string Role,
    KycResponse? Kyc  // Null if the user has not submitted KYC yet
);

// Nested inside UserProfileResponse — represents the user's KYC submission.
// Returned as part of the profile so the frontend can show document details
// and the admin's decision/note without a separate KYC endpoint.
public record KycResponse(
    Guid Id,
    string DocumentType,
    string DocumentNumber,
    string Status,        // "Pending", "Approved", or "Rejected"
    string? AdminNote,    // Null until an admin reviews the submission
    DateTime SubmittedAt,
    DateTime? ReviewedAt  // Null until an admin reviews the submission
);

// Generic wrapper used for ALL API responses so the frontend always receives
// a consistent shape: { success, message, data }.
// This makes error handling on the client side uniform — always check
// response.success before using response.data.
public record ApiResponse<T>(
    bool Success,    // True if the operation succeeded, false otherwise
    string Message,  // Human-readable description of the result
    T? Data          // The actual payload; null on error responses
);

// ── PIN DTOs ──────────────────────────────────────────────────────────────

// Returned by GET /api/auth/pin/status — tells the frontend whether the
// user has already set a transaction PIN so it can show "Set PIN" vs "Change PIN".
public record PinStatusResponse(
    bool HasPin
);

// Payload for POST /api/auth/pin/set.
// CurrentPin is required only when changing an existing PIN (HasPin == true).
// Keeping it optional here allows the same DTO for both "set new" and "change" flows.
public record SetPinRequest(
    string? CurrentPin,  // Required if the user already has a PIN; null for first-time setup
    string NewPin,       // The new 4-8 digit PIN to set
    string ConfirmPin    // Must match NewPin — validated in the controller
);

// Payload for POST /api/auth/pin/remove.
// Requires the current PIN to prevent an attacker with a stolen session
// from removing the PIN and then transacting freely.
public record RemovePinRequest(
    string CurrentPin
);

// Payload for the internal PIN verification endpoint called by WalletService.
// Kept separate from SetPinRequest to make the intent explicit.
public record VerifyPinRequest(
    string Pin
);

// ── PASSWORD RESET DTOs ───────────────────────────────────────────────────

// Step 1 — User provides their email to initiate the reset flow.
// The response is always "If account exists, OTP sent." to prevent
// user enumeration (an attacker cannot tell if an email is registered).
public record ForgotPasswordRequest(
    [Required, EmailAddress, MaxLength(120)]
    string Email
);

// Step 2 — User submits the 6-digit OTP they received by email.
// Regex enforces exactly 6 digits to reject malformed inputs early.
public record VerifyPasswordResetOtpRequest(
    [Required, EmailAddress, MaxLength(120)]
    string Email,

    [Required, RegularExpression(@"^\d{6}$",
        ErrorMessage = "OTP must be exactly 6 digits.")]
    string Otp
);

// Returned after a successful OTP verification.
// The reset token is a one-time-use secret that must be submitted in Step 3.
// ExpiresAtUtc lets the frontend show a countdown timer.
public record VerifyPasswordResetOtpResponse(
    string ResetToken,       // Opaque token — must be submitted with the new password
    DateTime ExpiresAtUtc    // UTC expiry — the token is invalid after this time
);

// Step 3 — User submits the reset token and their new password.
// Email is included so the service can look up the user without
// requiring an authenticated session (the user may be logged out).
// ResetToken MinLength(32) matches the GUID format used when generating it.
public record ResetPasswordRequest(
    [Required, EmailAddress, MaxLength(120)]
    string Email,

    // The reset token issued in Step 2 — must be at least 32 chars (GUID length)
    [Required, MinLength(32), MaxLength(256)]
    string ResetToken,

    // New password — same complexity rules as registration
    [Required,
     MinLength(8),
     MaxLength(64),
     RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,64}$",
         ErrorMessage = "Password must have uppercase, lowercase, number, and special character.")]
    string NewPassword,

    // Confirmation field — must match NewPassword; validated in the controller
    [Required, MinLength(8), MaxLength(64)]
    string ConfirmPassword
);
