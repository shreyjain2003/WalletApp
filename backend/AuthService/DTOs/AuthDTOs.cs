using System.ComponentModel.DataAnnotations;

namespace AuthService.DTOs;

public record RegisterRequest(
    [Required, MinLength(3), MaxLength(80)]
    string FullName,
    [Required, EmailAddress, MaxLength(120)]
    string Email,
    [Required, RegularExpression(@"^[6-9]\d{9}$",
        ErrorMessage = "Phone number must be a valid 10-digit mobile number.")]
    string PhoneNumber,
    [Required,
     MinLength(8),
     MaxLength(64),
     RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,64}$",
         ErrorMessage = "Password must have uppercase, lowercase, number, and special character.")]
    string Password
);

public record LoginRequest(
    [Required, EmailAddress, MaxLength(120)]
    string Email,
    [Required, MaxLength(64)]
    string Password
);

public record UpdateUserRequest(
    [Required, MinLength(3), MaxLength(80)]
    string FullName,
    [Required, EmailAddress, MaxLength(120)]
    string Email,
    [Required, RegularExpression(@"^[6-9]\d{9}$",
        ErrorMessage = "Phone number must be a valid 10-digit mobile number.")]
    string PhoneNumber
);

public record KycSubmitRequest(
    string DocumentType,
    string DocumentNumber
);

public record AuthResponse(
    string Token,
    string UserId,
    string FullName,
    string Email,
    string Role,
    string Status
);

public record UserProfileResponse(
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string Status,
    string Role,
    KycResponse? Kyc
);

public record KycResponse(
    Guid Id,
    string DocumentType,
    string DocumentNumber,
    string Status,
    string? AdminNote,
    DateTime SubmittedAt,
    DateTime? ReviewedAt
);

public record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data
);

public record PinStatusResponse(
    bool HasPin
);

public record SetPinRequest(
    string? CurrentPin,
    string NewPin,
    string ConfirmPin
);

public record RemovePinRequest(
    string CurrentPin
);

public record VerifyPinRequest(
    string Pin
);

public record ForgotPasswordRequest(
    [Required, EmailAddress, MaxLength(120)]
    string Email
);

public record VerifyPasswordResetOtpRequest(
    [Required, EmailAddress, MaxLength(120)]
    string Email,
    [Required, RegularExpression(@"^\d{6}$",
        ErrorMessage = "OTP must be exactly 6 digits.")]
    string Otp
);

public record VerifyPasswordResetOtpResponse(
    string ResetToken,
    DateTime ExpiresAtUtc
);

public record ResetPasswordRequest(
    [Required, EmailAddress, MaxLength(120)]
    string Email,
    [Required, MinLength(32), MaxLength(256)]
    string ResetToken,
    [Required,
     MinLength(8),
     MaxLength(64),
     RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,64}$",
         ErrorMessage = "Password must have uppercase, lowercase, number, and special character.")]
    string NewPassword,
    [Required, MinLength(8), MaxLength(64)]
    string ConfirmPassword
);
