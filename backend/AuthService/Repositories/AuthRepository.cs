using AuthService.Data;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Repositories;

public interface IAuthRepository
{
    Task<bool> EmailExistsAsync(string email, Guid? excludeUserId = null);
    Task<bool> PhoneExistsAsync(string phoneNumber, Guid? excludeUserId = null);
    Task<User?> GetUserByIdAsync(Guid userId, bool includeKyc = false);
    Task<User?> GetUserByEmailAsync(string email, bool includeKyc = false);
    Task<List<User>> GetUsersByRoleAsync(string role, bool includeKyc = false);
    Task AddUserAsync(User user);
    Task AddKycDocumentAsync(KycDocument document);
    void RemoveKycDocument(KycDocument document);
    void RemoveUser(User user);
    Task<int> SaveChangesAsync();
}

public class AuthRepository : IAuthRepository
{
    private readonly AuthDbContext _db;

    public AuthRepository(AuthDbContext db)
    {
        _db = db;
    }

    public Task<bool> EmailExistsAsync(string email, Guid? excludeUserId = null)
    {
        var query = _db.Users.AsQueryable();
        if (excludeUserId.HasValue)
            query = query.Where(u => u.Id != excludeUserId.Value);

        return query.AnyAsync(u => u.Email == email);
    }

    public Task<bool> PhoneExistsAsync(string phoneNumber, Guid? excludeUserId = null)
    {
        var query = _db.Users.AsQueryable();
        if (excludeUserId.HasValue)
            query = query.Where(u => u.Id != excludeUserId.Value);

        return query.AnyAsync(u => u.PhoneNumber == phoneNumber);
    }

    public Task<User?> GetUserByIdAsync(Guid userId, bool includeKyc = false)
    {
        var query = _db.Users.AsQueryable();
        if (includeKyc)
            query = query.Include(u => u.KycDocument);

        return query.FirstOrDefaultAsync(u => u.Id == userId);
    }

    public Task<User?> GetUserByEmailAsync(string email, bool includeKyc = false)
    {
        var query = _db.Users.AsQueryable();
        if (includeKyc)
            query = query.Include(u => u.KycDocument);

        return query.FirstOrDefaultAsync(u => u.Email == email);
    }

    public Task<List<User>> GetUsersByRoleAsync(string role, bool includeKyc = false)
    {
        var query = _db.Users.AsQueryable();
        if (includeKyc)
            query = query.Include(u => u.KycDocument);

        return query
            .Where(u => u.Role == role)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync();
    }

    public Task AddUserAsync(User user) => _db.Users.AddAsync(user).AsTask();

    public Task AddKycDocumentAsync(KycDocument document) => _db.KycDocuments.AddAsync(document).AsTask();

    public void RemoveKycDocument(KycDocument document) => _db.KycDocuments.Remove(document);

    public void RemoveUser(User user) => _db.Users.Remove(user);

    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();
}
