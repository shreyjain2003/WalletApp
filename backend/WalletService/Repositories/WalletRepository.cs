using Microsoft.EntityFrameworkCore;
using WalletService.Data;
using WalletService.Models;

namespace WalletService.Repositories;

public interface IWalletRepository
{
    Task<Wallet?> GetWalletByUserIdAsync(Guid userId);
    Task<Wallet?> GetWalletByIdAsync(Guid walletId);
    Task AddWalletAsync(Wallet wallet);
    Task<List<WalletTransaction>> GetTransactionsForWalletAsync(Guid walletId, int take = 50);
    Task AddTransactionAsync(WalletTransaction transaction);
    Task AddTransactionsAsync(params WalletTransaction[] transactions);
    Task<int> SaveChangesAsync();
}

public class WalletRepository : IWalletRepository
{
    private readonly WalletDbContext _db;

    public WalletRepository(WalletDbContext db)
    {
        _db = db;
    }

    public Task<Wallet?> GetWalletByUserIdAsync(Guid userId) =>
        _db.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);

    public Task<Wallet?> GetWalletByIdAsync(Guid walletId) =>
        _db.Wallets.FirstOrDefaultAsync(w => w.Id == walletId);

    public Task AddWalletAsync(Wallet wallet) => _db.Wallets.AddAsync(wallet).AsTask();

    public Task<List<WalletTransaction>> GetTransactionsForWalletAsync(Guid walletId, int take = 50) =>
        _db.WalletTransactions
            .Where(t => t.WalletId == walletId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(take)
            .ToListAsync();

    public Task AddTransactionAsync(WalletTransaction transaction) =>
        _db.WalletTransactions.AddAsync(transaction).AsTask();

    public Task AddTransactionsAsync(params WalletTransaction[] transactions) =>
        _db.WalletTransactions.AddRangeAsync(transactions);

    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();
}
