namespace WalletService.DTOs;

// DTO returned to the client whenever wallet information is requested.
// Contains only the fields the frontend needs — internal EF navigation
// properties and sensitive fields are deliberately excluded.
public record WalletResponse(
    Guid Id,           // Unique wallet identifier, useful for admin lookups
    Guid UserId,       // The owner of this wallet
    decimal Balance,   // Current available balance
    string Currency,   // ISO currency code (e.g. "INR")
    bool IsLocked,     // Whether the wallet is currently frozen by an admin
    DateTime CreatedAt // When the wallet was first created (UTC)
);

// Payload the frontend sends when a user wants to add funds to their wallet.
// Amount is validated server-side (must be > 0) before any DB write occurs.
public record TopUpRequest(
    decimal Amount,  // How much to credit — must be positive
    string? Note     // Optional memo the user can attach to this top-up
);

// Payload the frontend sends when a user wants to send money to another user.
// TransactionPin is required to prevent unauthorised transfers if a session
// is hijacked — it acts as a second factor for financial operations.
public record TransferRequest(
    Guid ReceiverUserId,    // The destination user (not wallet ID — resolved server-side)
    decimal Amount,         // How much to transfer — must be positive
    string? Note,           // Optional memo visible to both parties
    string? TransactionPin  // 4–6 digit PIN set by the user in AuthService
);

// DTO returned for each entry in the transaction history list.
// Mirrors the WalletTransaction model but uses only the fields the UI needs.
public record TransactionResponse(
    Guid Id,             // Unique transaction ID for deep-linking / support
    string Type,         // e.g. "topup", "transfer_out", "cashback"
    decimal Amount,      // Signed amount (positive = credit, negative = debit)
    decimal BalanceAfter,// Running balance snapshot after this transaction
    string Status,       // "Success", "Failed", etc.
    string Reference,    // Human-readable reference code for support lookups
    string? Note,        // Optional memo attached at transaction time
    DateTime CreatedAt   // When the transaction occurred (UTC)
);

// Wraps the binary content of a generated export file (CSV or PDF) so the
// controller can return it as a file download without knowing the format.
public record ExportFileResult(
    byte[] Content,      // Raw file bytes to stream to the client
    string ContentType,  // MIME type (e.g. "text/csv" or "application/pdf")
    string FileName      // Suggested download filename with timestamp
);

// Generic envelope used by every API endpoint in this service.
// Mirrors the same pattern used in AuthService so the frontend can handle
// all responses uniformly: check Success, show Message, consume Data.
public record ApiResponse<T>(
    bool Success,   // True when the operation completed without errors
    string Message, // Human-readable status or error description
    T? Data         // The actual payload; null on failure
);

// Admin-only request to forcibly set a user's wallet balance to a specific value.
// The service calculates the delta and records an "admin_adjustment" transaction
// so the change is fully auditable.
public record AdjustWalletRequest(
    Guid UserId,       // Which user's wallet to adjust
    decimal NewBalance,// The target balance to set (not a delta)
    string Reason      // Mandatory reason stored as the transaction note
);

// Admin-only request to lock or unlock a wallet.
// A locked wallet blocks all outgoing transfers until explicitly unlocked.
public record LockWalletRequest(
    Guid UserId,   // Which user's wallet to lock/unlock
    bool IsLocked  // True = lock the wallet, False = unlock it
);
