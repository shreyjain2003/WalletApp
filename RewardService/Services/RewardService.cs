using Microsoft.EntityFrameworkCore;
using RewardService.Data;
using RewardService.DTOs;
using RewardService.Models;

namespace RewardService.Services;

public interface IRewardService
{
    Task<ApiResponse<RewardResponse>> GetOrCreateRewardAsync(Guid userId);
    Task<ApiResponse<RewardResponse>> AddPointsAsync(Guid userId, int points, string reason, string reference);
    Task<ApiResponse<List<RewardTransactionResponse>>> GetHistoryAsync(Guid userId);
}

public class RewardService : IRewardService
{
    private readonly RewardDbContext _db;
    private readonly IRabbitMqPublisher _mq;

    public RewardService(RewardDbContext db, IRabbitMqPublisher mq)
    {
        _db = db;
        _mq = mq;
    }

    // ── GET OR CREATE REWARD ACCOUNT ──────────────────────────────────────
    // Every user gets a reward account automatically on first access
    public async Task<ApiResponse<RewardResponse>> GetOrCreateRewardAsync(Guid userId)
    {
        var reward = await _db.Rewards
            .FirstOrDefaultAsync(r => r.UserId == userId);

        if (reward == null)
        {
            reward = new Reward
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                PointsBalance = 0,
                TotalEarned = 0,
                Tier = "Bronze",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _db.Rewards.Add(reward);
            await _db.SaveChangesAsync();
        }

        return new ApiResponse<RewardResponse>(true, "OK", MapReward(reward));
    }

    // ── ADD POINTS ────────────────────────────────────────────────────────
    // Called when a transfer is completed — awards 10 points per transfer
    public async Task<ApiResponse<RewardResponse>> AddPointsAsync(
        Guid userId, int points, string reason, string reference)
    {
        // 1. Get or create reward account
        var reward = await _db.Rewards
            .FirstOrDefaultAsync(r => r.UserId == userId);

        if (reward == null)
        {
            reward = new Reward
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                PointsBalance = 0,
                TotalEarned = 0,
                Tier = "Bronze",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _db.Rewards.Add(reward);
        }

        // 2. Add points
        reward.PointsBalance += points;
        reward.TotalEarned += points;
        reward.UpdatedAt = DateTime.UtcNow;

        // 3. Check tier upgrade
        // Bronze → Silver at 1000 points
        // Silver → Gold at 5000 points
        var oldTier = reward.Tier;
        reward.Tier = reward.TotalEarned switch
        {
            >= 5000 => "Gold",
            >= 1000 => "Silver",
            _ => "Bronze"
        };

        // 4. Log the points transaction
        var tx = new RewardTransaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Points = points,
            Reason = reason,
            Reference = reference,
            CreatedAt = DateTime.UtcNow
        };

        _db.RewardTransactions.Add(tx);
        await _db.SaveChangesAsync();

        // 5. Notify user if tier changed
        if (oldTier != reward.Tier)
        {
            _mq.Publish("notifications", new
            {
                UserId = userId.ToString(),
                Title = $"Tier Upgraded to {reward.Tier}!",
                Message = $"Congratulations! You've reached {reward.Tier} tier.",
                Type = "tier_upgrade"
            });
        }

        return new ApiResponse<RewardResponse>(true, $"{points} points added.", MapReward(reward));
    }

    // ── GET HISTORY ───────────────────────────────────────────────────────
    public async Task<ApiResponse<List<RewardTransactionResponse>>> GetHistoryAsync(Guid userId)
    {
        var transactions = await _db.RewardTransactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .ToListAsync();

        var result = transactions.Select(t => new RewardTransactionResponse(
            t.Id, t.Points, t.Reason, t.Reference, t.CreatedAt
        )).ToList();

        return new ApiResponse<List<RewardTransactionResponse>>(true, "OK", result);
    }

    // ── HELPER ────────────────────────────────────────────────────────────
    private static RewardResponse MapReward(Reward r) =>
        new(r.Id, r.UserId, r.PointsBalance, r.TotalEarned, r.Tier, r.UpdatedAt);
}