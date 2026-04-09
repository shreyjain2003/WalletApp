using Microsoft.EntityFrameworkCore;
using RewardService.Data;
using RewardService.Models;

namespace RewardService.Repositories;

public interface IRewardRepository
{
    Task<Reward?> GetRewardByUserIdAsync(Guid userId);
    Task AddRewardAsync(Reward reward);
    Task AddRewardTransactionAsync(RewardTransaction transaction);
    Task<List<RewardTransaction>> GetRewardHistoryAsync(Guid userId, int take = 50);
    Task<int> SaveChangesAsync();
}

public class RewardRepository : IRewardRepository
{
    private readonly RewardDbContext _db;

    public RewardRepository(RewardDbContext db)
    {
        _db = db;
    }

    public Task<Reward?> GetRewardByUserIdAsync(Guid userId) =>
        _db.Rewards.FirstOrDefaultAsync(r => r.UserId == userId);

    public Task AddRewardAsync(Reward reward) => _db.Rewards.AddAsync(reward).AsTask();

    public Task AddRewardTransactionAsync(RewardTransaction transaction) =>
        _db.RewardTransactions.AddAsync(transaction).AsTask();

    public Task<List<RewardTransaction>> GetRewardHistoryAsync(Guid userId, int take = 50) =>
        _db.RewardTransactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(take)
            .ToListAsync();

    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();
}
