namespace AdminService.DTOs;

// Admin login
public record AdminLoginRequest(
    string Email,
    string Password
);

public record AdminLoginResponse(
    string Token,
    string AdminId,
    string FullName,
    string Email
);

// KYC review
public record KycReviewResponse(
    Guid Id,
    Guid UserId,
    string UserFullName,
    string UserEmail,
    string DocumentType,
    string DocumentNumber,
    string Status,
    string? AdminNote,
    DateTime SubmittedAt,
    DateTime? ReviewedAt
);

public record KycDecisionRequest(
    string Decision,   // "Approved" or "Rejected"
    string? AdminNote
);

// Support tickets
public record SupportTicketResponse(
    Guid Id,
    Guid UserId,
    string UserEmail,
    string Subject,
    string Message,
    string Status,
    string? AdminReply,
    DateTime CreatedAt,
    DateTime? RespondedAt
);

public record TicketReplyRequest(
    string Reply
);

// Generic wrapper
public record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data
);
public record SubmitTicketRequest(
    string Subject,
    string Message
);