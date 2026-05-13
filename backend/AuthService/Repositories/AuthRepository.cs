// ============================================================
// AuthRepository.cs — AuthService
// ------------------------------------------------------------
// Implements the Repository Pattern for all database operations
// related to Users, KycDocuments, and PasswordResetSessions.
//
// The Repository Pattern separates data-access logic from business
// logic. AuthService (the service class) calls this repository and
// never writes raw EF Core queries itself. This means:
//   - Unit tests can inject FakeAuthRepository without a real DB.
//   - If we ever switch from SQL Server to another database, only
//     this file needs to change — the service layer stays the same.
//
// All methods are async (Task<T>) because database I/O is inherently
// asynchronous — awaiting them frees the thread to handle other
// requests while waiting for SQL Server to respond.
// ============================================================

using AuthService.Data;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Repositories;

// Interface defines the contract — what operations are available.
// The service layer depends on this interface, not the concrete class,
// enabling easy mocking in unit tests.
public interface IAuthRepository
{
    Task<bool> EmailExistsAsync(string email, Guid? excludeUserId = null);
    Task<bool> PhoneExistsAsync(string phoneNumber, Guid? excludeUserId = null);
    Task<User?> GetUserByIdAsync(Guid userId, bool includeKyc = false);
    Task<User?> GetUserByEmailAsync(string email, bool includeKyc = false);
    Task<List<User>> GetUsersByRoleAsync(string role, bool includeKyc = false);
    Task AddUserAsync(User user);
    Task AddKycDocumentAsync(KycDocument document);
    Task AddPasswordResetSessionAsync(PasswordResetSession session);
    Task<PasswordResetSession?> GetLatestPasswordResetSessionAsync(Guid userId, string purpose);
    Task<PasswordResetSession?> GetLatestVerifiedPasswordResetSessionAsync(Guid userId, string purpose);
    Task InvalidatePasswordResetSessionsAsync(Guid userId, string purpose, Guid? excludeSessionId = null);
    void RemoveKycDocument(KycDocument document);
    void RemoveUser(User user);
    Task<int> SaveChangesAsync();
}

public class AuthRepository : IAuthRepository
{
    // AuthDbContext is the EF Core database context — it represents the
    // SQL Server connection and tracks entity changes.
    // Injected as Scoped (one instance per HTTP request) by the DI container.
    private readonly AuthDbContext _db;

    public AuthRepository(AuthDbContext db)
    {
        _db = db;
    }

    // ── EmailExistsAsync ─────────────────────────────────────────────────────
    // Checks whether an email address is already registered.
    // excludeUserId: when updating a profile, exclude the current user so they
    // can "keep" their own email without triggering a false duplicate error.
    // EF Core translates this to: SELECT CASE WHEN EXISTS(...) THEN 1 ELSE 0 END
    public Task<bool> EmailExistsAsync(string email, Guid? excludeUserId = null)
    {
        var query = _db.Users.AsQueryable();
        if (excludeUserId.HasValue)
            query = query.Where(u => u.Id != excludeUserId.Value);

        return query.AnyAsync(u => u.Email == email);
    }

    // ── PhoneExistsAsync ─────────────────────────────────────────────────────
    // Same pattern as EmailExistsAsync but for phone numbers.
    // Phone numbers must also be globally unique across all users.
    public Task<bool> PhoneExistsAsync(string phoneNumber, Guid? excludeUserId = null)
    {
        var query = _db.Users.AsQueryable();
        if (excludeUserId.HasValue)
            query = query.Where(u => u.Id != excludeUserId.Value);

        return query.AnyAsync(u => u.PhoneNumber == phoneNumber);
    }

    // ── GetUserByIdAsync ─────────────────────────────────────────────────────
    // Fetches a single user by their primary key (GUID).
    // includeKyc: when true, EF Core performs a LEFT JOIN to also load the
    // related KycDocument entity in the same SQL query (eager loading).
    // Returns null if no user with that ID exists.
    public Task<User?> GetUserByIdAsync(Guid userId, bool includeKyc = false)
    {
        var query = _db.Users.AsQueryable();
        if (includeKyc)
            query = query.Include(u => u.KycDocument); // LEFT JOIN KycDocuments

        return query.FirstOrDefaultAsync(u => u.Id == userId);
    }

    // ── GetUserByEmailAsync ──────────────────────────────────────────────────
    // Fetches a user by their email address (used for login and password reset).
    // Emails are stored lowercase so this comparison is case-insensitive by design.
    // includeKyc: same eager-loading option as GetUserByIdAsync.
    public Task<User?> GetUserByEmailAsync(string email, bool includeKyc = false)
    {
        var query = _db.Users.AsQueryable();
        if (includeKyc)
            query = query.Include(u => u.KycDocument);

        return query.FirstOrDefaultAsync(u => u.Email == email);
    }

    // ── GetUsersByRoleAsync ──────────────────────────────────────────────────
    // Returns all users with a specific role, ordered newest-first.
    // Used by the admin panel's user list and by the internal /users endpoint
    // that AdminService calls to sync KYC records.
    public Task<List<User>> GetUsersByRoleAsync(string role, bool includeKyc = false)
    {
        var query = _db.Users.AsQueryable();
        if (includeKyc)
            query = query.Include(u => u.KycDocument);

        return query
            .Where(u => u.Role == role)
            .OrderByDescending(u => u.CreatedAt) // newest users first
            .ToListAsync();
    }

    // ── AddUserAsync ─────────────────────────────────────────────────────────
    // Stages a new User entity for insertion.
    // The INSERT SQL is not executed until SaveChangesAsync() is called.
    // AsTask() converts ValueTask<EntityEntry<User>> to Task for consistency.
    public Task AddUserAsync(User user) => _db.Users.AddAsync(user).AsTask();

    // ── AddKycDocumentAsync ──────────────────────────────────────────────────
    // Stages a new KycDocument entity for insertion.
    // Called when a user submits their identity documents for the first time.
    public Task AddKycDocumentAsync(KycDocument document) => _db.KycDocuments.AddAsync(document).AsTask();

    // ── AddPasswordResetSessionAsync ─────────────────────────────────────────
    // Stages a new PasswordResetSession for insertion.
    // Each OTP request creates a new session row — old sessions are not deleted,
    // they are simply superseded by the newest one.
    public Task AddPasswordResetSessionAsync(PasswordResetSession session) =>
        _db.PasswordResetSessions.AddAsync(session).AsTask();

    // ── GetLatestPasswordResetSessionAsync ───────────────────────────────────
    // Retrieves the most recently created reset session for a user and purpose.
    // Used in VerifyOtpAsync to find the active session to validate against.
    // Returns null if no session exists.
    public Task<PasswordResetSession?> GetLatestPasswordResetSessionAsync(Guid userId, string purpose) =>
        _db.PasswordResetSessions
            .Where(s => s.UserId == userId && s.Purpose == purpose)
            .OrderByDescending(s => s.CreatedAtUtc) // most recent first
            .FirstOrDefaultAsync();

    // ── GetLatestVerifiedPasswordResetSessionAsync ───────────────────────────
    // Retrieves the most recently verified, unused reset session.
    // Used in ResetPasswordAsync to find the session that holds the valid reset token.
    // Filters:
    //   VerifiedAtUtc != null  — OTP was successfully verified
    //   UsedAtUtc == null      — reset token has not been used yet (prevents replay)
    //   ResetTokenHash != null — a reset token was actually generated
    //   ResetTokenExpiresAtUtc != null — expiry was set
    public Task<PasswordResetSession?> GetLatestVerifiedPasswordResetSessionAsync(Guid userId, string purpose) =>
        _db.PasswordResetSessions
            .Where(s => s.UserId == userId
                && s.Purpose == purpose
                && s.VerifiedAtUtc != null
                && s.UsedAtUtc == null          // not yet used
                && s.ResetTokenHash != null
                && s.ResetTokenExpiresAtUtc != null)
            .OrderByDescending(s => s.VerifiedAtUtc)
            .FirstOrDefaultAsync();

    // ── InvalidatePasswordResetSessionsAsync ─────────────────────────────────
    // Marks all active (unused) sessions for a user as used, effectively
    // invalidating them. Used to clean up old sessions when a new OTP is requested.
    // excludeSessionId: optionally keep one session alive (the newly created one).
    public async Task InvalidatePasswordResetSessionsAsync(
        Guid userId,
        string purpose,
        Guid? excludeSessionId = null)
    {
        var sessions = await _db.PasswordResetSessions
            .Where(s => s.UserId == userId
                && s.Purpose == purpose
                && s.UsedAtUtc == null // only invalidate unused sessions
                && (!excludeSessionId.HasValue || s.Id != excludeSessionId.Value))
            .ToListAsync();

        if (sessions.Count == 0)
            return;

        // Mark all matching sessions as used at the current UTC time.
        var now = DateTime.UtcNow;
        foreach (var session in sessions)
            session.UsedAtUtc = now;
        // Caller must call SaveChangesAsync() to persist these changes.
    }

    // ── RemoveKycDocument ────────────────────────────────────────────────────
    // Marks a KycDocument entity for deletion.
    // The DELETE SQL runs when SaveChangesAsync() is called.
    // Used when deleting a user (cascade) or when an admin resets KYC.
    public void RemoveKycDocument(KycDocument document) => _db.KycDocuments.Remove(document);

    // ── RemoveUser ───────────────────────────────────────────────────────────
    // Marks a User entity for deletion.
    // The DELETE SQL runs when SaveChangesAsync() is called.
    // The FK_Kyc_Users constraint has ON DELETE CASCADE, so the related
    // KycDocument is also deleted automatically by SQL Server.
    public void RemoveUser(User user) => _db.Users.Remove(user);

    // ── SaveChangesAsync ─────────────────────────────────────────────────────
    // Flushes all pending EF Core change-tracker operations to SQL Server
    // in a single database round-trip. Returns the number of rows affected.
    // Must be called after any Add/Update/Remove operation to persist changes.
    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();
}
