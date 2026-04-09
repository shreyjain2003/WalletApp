using RewardService.DTOs;
using RewardService.Models;
using RewardService.Repositories;

namespace RewardService.Services;

public interface IRewardService
{
    Task<ApiResponse<RewardResponse>> GetOrCreateRewardAsync(Guid userId);
    Task<ApiResponse<RewardResponse>> AddPointsAsync(Guid userId, int points, string reason, string reference);
    Task<ApiResponse<List<RewardTransactionResponse>>> GetHistoryAsync(Guid userId);
}

public class RewardService : IRewardService
{
    private readonly IRewardRepository _repo;
    private readonly IRabbitMqPublisher _mq;

    public RewardService(IRewardRepository repo, IRabbitMqPublisher mq)
    {
        _repo = repo;
        _mq = mq;
    }

    public async Task<ApiResponse<RewardResponse>> GetOrCreateRewardAsync(Guid userId)
    {
        var reward = await _repo.GetRewardByUserIdAsync(userId);

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
            await _repo.AddRewardAsync(reward);
            await _repo.SaveChangesAsync();
        }

        return new ApiResponse<RewardResponse>(true, "OK", MapReward(reward));
    }

    public async Task<ApiResponse<RewardResponse>> AddPointsAsync(
        Guid userId, int points, string reason, string reference)
    {
        var reward = await _repo.GetRewardByUserIdAsync(userId);

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
            await _repo.AddRewardAsync(reward);
        }

        reward.PointsBalance += points;
        reward.TotalEarned += points;
        reward.UpdatedAt = DateTime.UtcNow;

        var oldTier = reward.Tier;
        reward.Tier = reward.TotalEarned switch
        {
            >= 5000 => "Gold",
            >= 1000 => "Silver",
            _ => "Bronze"
        };

        var tx = new RewardTransaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Points = points,
            Reason = reason,
            Reference = reference,
            CreatedAt = DateTime.UtcNow
        };

        await _repo.AddRewardTransactionAsync(tx);
        await _repo.SaveChangesAsync();

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

    public async Task<ApiResponse<List<RewardTransactionResponse>>> GetHistoryAsync(Guid userId)
    {
        var transactions = await _repo.GetRewardHistoryAsync(userId);

        var result = transactions.Select(t => new RewardTransactionResponse(
            t.Id, t.Points, t.Reason, t.Reference, t.CreatedAt
        )).ToList();

        return new ApiResponse<List<RewardTransactionResponse>>(true, "OK", result);
    }

    private static RewardResponse MapReward(Reward reward) =>
        new(reward.Id, reward.UserId, reward.PointsBalance, reward.TotalEarned, reward.Tier, reward.UpdatedAt);
}
