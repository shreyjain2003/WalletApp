namespace RewardService.DTOs;

// What we SEND BACK for reward info
public record RewardResponse(
    Guid Id,
    Guid UserId,
    int PointsBalance,
    int TotalEarned,
    string Tier,
    DateTime UpdatedAt
);

// What we SEND BACK for each points transaction
public record RewardTransactionResponse(
    Guid Id,
    int Points,
    string Reason,
    string Reference,
    DateTime CreatedAt
);

// Generic wrapper
public record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data
);