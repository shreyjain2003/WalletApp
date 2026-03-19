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