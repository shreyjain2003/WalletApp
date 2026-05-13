namespace AdminService.DTOs;

// Payload the admin panel sends when an admin wants to sign in.
// AdminService does not store passwords — it delegates credential verification
// to AuthService and only proceeds if the resolved account has the "Admin" role.
public record AdminLoginRequest(
    string Email,    // Admin's email address used to look up the account in AuthService
    string Password  // Plain-text password forwarded to AuthService's login endpoint
);

// Returned to the admin panel after a successful login.
// Contains the JWT token (issued by AuthService) that the panel must include
// in the Authorization header for all subsequent admin API calls.
public record AdminLoginResponse(
    string Token,    // JWT bearer token — valid for the duration configured in AuthService
    string AdminId,  // The admin's user ID, useful for audit trail display in the UI
    string FullName, // Display name shown in the admin panel header
    string Email     // Admin's email, useful for session display and logging
);

// DTO returned for each KYC review entry in the pending queue.
// Contains all the information an admin needs to make an Approved/Rejected decision
// without having to call AuthService separately.
public record KycReviewResponse(
    Guid Id,               // KYC review record ID — used in the /kyc/{id}/decide endpoint
    Guid UserId,           // The user whose identity is being reviewed
    string UserFullName,   // Full name as submitted by the user
    string UserEmail,      // Email address for notification delivery
    string DocumentType,   // e.g. "Passport", "Aadhaar", "PAN"
    string DocumentNumber, // The actual document identifier to verify
    string Status,         // "Pending", "Approved", or "Rejected"
    string? AdminNote,     // Reason for rejection (null if pending or approved)
    DateTime SubmittedAt,  // When the user submitted — used to sort oldest-first
    DateTime? ReviewedAt   // When the admin made the decision (null if still pending)
);

// Payload the admin sends when approving or rejecting a KYC submission.
// Decision must be exactly "Approved" or "Rejected" — validated in the service layer.
public record KycDecisionRequest(
    string Decision,   // "Approved" or "Rejected" — any other value is rejected with 400
    string? AdminNote  // Required when rejecting so the user knows why; optional on approval
);

// DTO returned for each support ticket in the admin ticket list or user's "my tickets" view.
// Includes both the original user message and the admin reply (if any) so the full
// conversation is visible in a single response.
public record SupportTicketResponse(
    Guid Id,               // Ticket ID — used in the /tickets/{id}/reply endpoint
    Guid UserId,           // The user who submitted the ticket
    string UserEmail,      // Email address for notification delivery
    string Subject,        // Short summary of the issue
    string Message,        // Full description of the issue
    string Status,         // "Open" or "Responded"
    string? AdminReply,    // The admin's reply text (null while still open)
    DateTime CreatedAt,    // When the ticket was submitted
    DateTime? RespondedAt  // When the admin replied (null while still open)
);

// Payload the admin sends when replying to a support ticket.
// The reply text is stored on the ticket and triggers a notification to the user.
public record TicketReplyRequest(
    string Reply  // The admin's response message — must not be empty
);

// Generic envelope used by every API endpoint in this service.
// Mirrors the same pattern used in WalletService and AuthService so the
// frontend can handle all responses uniformly: check Success, show Message, consume Data.
public record ApiResponse<T>(
    bool Success,   // True when the operation completed without errors
    string Message, // Human-readable status or error description
    T? Data         // The actual payload; null on failure
);

// Payload a regular authenticated user sends when raising a support ticket.
// The user's ID is taken from the JWT claim — not from this request body —
// so a user cannot submit a ticket on behalf of another user.
public record SubmitTicketRequest(
    string Subject, // Short summary of the issue (max 300 chars enforced at DB level)
    string Message  // Full description of the problem or question
);
