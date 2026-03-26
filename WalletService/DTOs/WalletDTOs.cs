namespace WalletService.DTOs;

// What we SEND BACK for wallet info
public record WalletResponse(
    Guid Id,
    Guid UserId,
    decimal Balance,
    string Currency,
    bool IsLocked,
    DateTime CreatedAt
);

// What frontend SENDS for top-up
public record TopUpRequest(
    decimal Amount,
    string? Note
);

// What frontend SENDS for transfer
public record TransferRequest(
    Guid ReceiverUserId,
    decimal Amount,
    string? Note
);

// What we SEND BACK for a transaction
public record TransactionResponse(
    Guid Id,
    string Type,
    decimal Amount,
    decimal BalanceAfter,
    string Status,
    string Reference,
    string? Note,
    DateTime CreatedAt
);

// Generic API response wrapper — same pattern as AuthService
public record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data
);
public record AdjustWalletRequest(Guid UserId, decimal NewBalance, string Reason);
public record LockWalletRequest(Guid UserId, bool IsLocked);