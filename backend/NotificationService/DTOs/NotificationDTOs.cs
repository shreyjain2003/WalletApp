namespace NotificationService.DTOs;

public record NotificationResponse(
    Guid Id,
    string UserId,
    string Title,
    string Message,
    string Type,
    bool IsRead,
    DateTime CreatedAt
);

public record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data
);

public record MoneyRequestNotificationRequest(
    string RecipientUserId,
    decimal Amount,
    string? Note
);

public record InternalNotificationRequest(
    string UserId,
    string? Email,
    string Title,
    string Message,
    string Type,
    decimal? Amount = null,
    string? Reference = null,
    string? Note = null,
    string? CounterpartyName = null,
    string? CounterpartyEmail = null,
    decimal? BalanceAfter = null,
    DateTime? OccurredAtUtc = null,
    string? Otp = null
);
