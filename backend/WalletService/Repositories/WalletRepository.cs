// ============================================================
// WalletRepository.cs — WalletService
// ------------------------------------------------------------
// Implements the Repository Pattern for all database operations
// on the Wallets and WalletTransactions tables.
//
// Key design decision — ExecuteInTransactionAsync:
//   Money transfers require two balance updates (debit sender,
//   credit receiver) and two transaction inserts to happen
//   atomically. If any step fails, both must roll back.
//   ExecuteInTransactionAsync wraps any delegate in a SQL Server
//   transaction, keeping transaction management out of the service
//   layer (which only knows about business logic).
//
// All methods are async because SQL I/O is inherently asynchronous.
// ============================================================

using Microsoft.EntityFrameworkCore;
using WalletService.Data;
using WalletService.Models;

namespace WalletService.Repositories;

// Interface allows unit tests to inject FakeWalletRepository without
// needing a real SQL Server connection.
public interface IWalletRepository
{
    Task<Wallet?> GetWalletByUserIdAsync(Guid userId);
    Task<Wallet?> GetWalletByIdAsync(Guid walletId);
    Task AddWalletAsync(Wallet wallet);
    Task<List<WalletTransaction>> GetTransactionsForWalletAsync(Guid walletId, int take = 50);
    Task AddTransactionAsync(WalletTransaction transaction);
    Task AddTransactionsAsync(params WalletTransaction[] transactions);
    Task<int> SaveChangesAsync();
    Task ExecuteInTransactionAsync(Func<Task> action);
}

public class WalletRepository : IWalletRepository
{
    // WalletDbContext is the EF Core context for this service's SQL Server database.
    // Injected as Scoped (one instance per HTTP request) by the DI container.
    private readonly WalletDbContext _db;

    public WalletRepository(WalletDbContext db)
    {
        _db = db;
    }

    // ── GetWalletByUserIdAsync ───────────────────────────────────────────────
    // Fetches a wallet by the owner's user ID.
    // Returns null if the user has no wallet yet (wallet is created on first access
    // or when KYC is approved).
    // The Wallets table has a unique index on UserId so this is always a point lookup.
    public Task<Wallet?> GetWalletByUserIdAsync(Guid userId) =>
        _db.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);

    // ── GetWalletByIdAsync ───────────────────────────────────────────────────
    // Fetches a wallet by its own primary key (wallet GUID).
    // Used when we have the wallet ID directly (e.g. from a transaction record).
    public Task<Wallet?> GetWalletByIdAsync(Guid walletId) =>
        _db.Wallets.FirstOrDefaultAsync(w => w.Id == walletId);

    // ── AddWalletAsync ───────────────────────────────────────────────────────
    // Stages a new Wallet entity for insertion.
    // The INSERT SQL runs when SaveChangesAsync() is called.
    public Task AddWalletAsync(Wallet wallet) => _db.Wallets.AddAsync(wallet).AsTask();

    // ── GetTransactionsForWalletAsync ────────────────────────────────────────
    // Returns the most recent transactions for a wallet, ordered newest-first.
    // Default take = 50 for the history page.
    // Pass int.MaxValue for CSV/PDF export to get all transactions without a cap.
    public Task<List<WalletTransaction>> GetTransactionsForWalletAsync(Guid walletId, int take = 50) =>
        _db.WalletTransactions
            .Where(t => t.WalletId == walletId)
            .OrderByDescending(t => t.CreatedAt) // newest first
            .Take(take)                           // limit rows (use int.MaxValue for export)
            .ToListAsync();

    // ── AddTransactionAsync ──────────────────────────────────────────────────
    // Stages a single WalletTransaction for insertion.
    // Used for top-up and admin adjustment (single transaction per operation).
    public Task AddTransactionAsync(WalletTransaction transaction) =>
        _db.WalletTransactions.AddAsync(transaction).AsTask();

    // ── AddTransactionsAsync ─────────────────────────────────────────────────
    // Stages multiple WalletTransactions for insertion in one call.
    // Used for transfers: both the sender's "transfer_out" and the receiver's
    // "transfer_in" transaction are inserted together inside the same DB transaction.
    // params allows calling: AddTransactionsAsync(senderTx, receiverTx)
    public Task AddTransactionsAsync(params WalletTransaction[] transactions) =>
        _db.WalletTransactions.AddRangeAsync(transactions);

    // ── SaveChangesAsync ─────────────────────────────────────────────────────
    // Flushes all pending EF Core change-tracker operations to SQL Server.
    // Returns the number of rows affected.
    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();

    // ── ExecuteInTransactionAsync ────────────────────────────────────────────
    // Wraps a delegate in a SQL Server database transaction.
    // This is the key method that makes money transfers atomic:
    //
    //   await _repo.ExecuteInTransactionAsync(async () =>
    //   {
    //       senderWallet.Balance -= amount;    // debit
    //       receiverWallet.Balance += amount;  // credit
    //       await _repo.AddTransactionsAsync(senderTx, receiverTx);
    //       await _repo.SaveChangesAsync();
    //   });
    //
    // If any line inside the delegate throws, the catch block calls RollbackAsync()
    // and re-throws the exception. This guarantees that either BOTH wallets are
    // updated OR neither is — preventing partial transfers (money disappearing).
    //
    // The Func<Task> parameter (delegate) is the "action" pattern — it lets the
    // service layer pass in its business logic without knowing about transactions.
    public async Task ExecuteInTransactionAsync(Func<Task> action)
    {
        // Begin a SQL Server transaction — all subsequent SQL runs inside it.
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Execute the caller's business logic (balance updates + inserts).
            await action();

            // If no exception was thrown, commit all changes atomically.
            await tx.CommitAsync();
        }
        catch
        {
            // Something went wrong — undo all changes made inside the transaction.
            await tx.RollbackAsync();

            // Re-throw so the service layer can return an error to the controller.
            throw;
        }
    }
}
