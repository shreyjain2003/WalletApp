// ============================================================
// TransactionPinRepository.cs — AuthService
// ------------------------------------------------------------
// Manages all database operations for the TransactionPins table.
// Transaction PINs are 4–8 digit codes that users must enter before
// every money transfer. They are BCrypt-hashed before storage —
// the plain PIN is never persisted anywhere.
//
// Table structure (created in Program.cs startup SQL):
//   UserId    UNIQUEIDENTIFIER PK  — one PIN per user (1:1 with Users)
//   PinHash   NVARCHAR(200)        — BCrypt hash of the PIN
//   CreatedAt DATETIME2            — when the PIN was first set
//   UpdatedAt DATETIME2            — when the PIN was last changed
//
// The table uses UserId as the primary key (not a separate Id column)
// because each user can have at most one PIN at a time.
// ============================================================

using AuthService.Data;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Repositories;

// Interface allows PinController and unit tests to depend on the
// abstraction rather than the concrete EF Core implementation.
public interface ITransactionPinRepository
{
    Task<bool> HasPinAsync(Guid userId);
    Task<bool> VerifyPinAsync(Guid userId, string pin);
    Task SetPinAsync(Guid userId, string pin);
    Task RemovePinAsync(Guid userId);
}

public class TransactionPinRepository : ITransactionPinRepository
{
    // AuthDbContext provides access to the TransactionPins DbSet.
    // Injected as Scoped (one instance per HTTP request).
    private readonly AuthDbContext _db;

    public TransactionPinRepository(AuthDbContext db)
    {
        _db = db;
    }

    // ── HasPinAsync ──────────────────────────────────────────────────────────
    // Returns true if a PIN record exists for the given user.
    // Used by:
    //   - PinController.GetPinStatus() — to show "Set PIN" vs "Change PIN" UI
    //   - PinController.SetPin()       — to decide whether to require CurrentPin
    //   - PinController.VerifyPinInternal() — to block transfers if no PIN is set
    // EF Core translates AnyAsync to: SELECT CASE WHEN EXISTS(...) THEN 1 ELSE 0 END
    public Task<bool> HasPinAsync(Guid userId) =>
        _db.TransactionPins.AnyAsync(p => p.UserId == userId);

    // ── VerifyPinAsync ───────────────────────────────────────────────────────
    // Checks whether the submitted plain-text PIN matches the stored BCrypt hash.
    // BCrypt.Verify re-hashes the input with the salt embedded in the stored hash
    // and compares — this is the only correct way to verify a BCrypt hash.
    // Returns false if no PIN record exists (user has not set a PIN yet).
    public async Task<bool> VerifyPinAsync(Guid userId, string pin)
    {
        // FindAsync uses the primary key (UserId) for an efficient point lookup.
        var record = await _db.TransactionPins.FindAsync(userId);

        // Short-circuit: if no record exists, verification fails.
        return record != null && BCrypt.Net.BCrypt.Verify(pin, record.PinHash);
    }

    // ── SetPinAsync ──────────────────────────────────────────────────────────
    // Creates a new PIN or replaces an existing one.
    // The plain PIN is hashed with BCrypt before storage.
    // Uses an upsert pattern: update if a record exists, insert if it does not.
    // SaveChangesAsync is called here (not by the caller) because PIN operations
    // are always standalone — they are not part of a larger transaction.
    public async Task SetPinAsync(Guid userId, string pin)
    {
        // Hash the plain PIN with BCrypt (cost factor 10 by default, ~100ms).
        var hash = BCrypt.Net.BCrypt.HashPassword(pin);

        // Check if a PIN record already exists for this user.
        var existing = await _db.TransactionPins.FindAsync(userId);

        if (existing != null)
        {
            // Update the existing record — just replace the hash and timestamp.
            existing.PinHash = hash;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            // Insert a new record — this is the first time the user sets a PIN.
            _db.TransactionPins.Add(new TransactionPin
            {
                UserId = userId,
                PinHash = hash,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        // Persist the insert or update to SQL Server.
        await _db.SaveChangesAsync();
    }

    // ── RemovePinAsync ───────────────────────────────────────────────────────
    // Deletes the PIN record for the given user.
    // Called when the user explicitly removes their PIN from the Set-PIN page.
    // After removal, transfers will show a warning that no PIN is set.
    // Does nothing if no PIN record exists (idempotent).
    public async Task RemovePinAsync(Guid userId)
    {
        var existing = await _db.TransactionPins.FindAsync(userId);
        if (existing != null)
        {
            _db.TransactionPins.Remove(existing);
            await _db.SaveChangesAsync();
        }
    }
}
