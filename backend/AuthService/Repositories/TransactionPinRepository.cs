using AuthService.Data;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Repositories;

public interface ITransactionPinRepository
{
    Task<bool> HasPinAsync(Guid userId);
    Task<bool> VerifyPinAsync(Guid userId, string pin);
    Task SetPinAsync(Guid userId, string pin);
    Task RemovePinAsync(Guid userId);
}

public class TransactionPinRepository : ITransactionPinRepository
{
    private readonly AuthDbContext _db;

    public TransactionPinRepository(AuthDbContext db)
    {
        _db = db;
    }

    public Task<bool> HasPinAsync(Guid userId) =>
        _db.TransactionPins.AnyAsync(p => p.UserId == userId);

    public async Task<bool> VerifyPinAsync(Guid userId, string pin)
    {
        var record = await _db.TransactionPins.FindAsync(userId);
        return record != null && BCrypt.Net.BCrypt.Verify(pin, record.PinHash);
    }

    public async Task SetPinAsync(Guid userId, string pin)
    {
        var hash = BCrypt.Net.BCrypt.HashPassword(pin);
        var existing = await _db.TransactionPins.FindAsync(userId);

        if (existing != null)
        {
            existing.PinHash = hash;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _db.TransactionPins.Add(new TransactionPin
            {
                UserId = userId,
                PinHash = hash,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
    }

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
