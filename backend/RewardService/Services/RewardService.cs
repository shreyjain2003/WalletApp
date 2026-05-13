// RewardService.cs
// Core business logic for the reward points system.
// Responsible for creating reward accounts on first use, crediting points,
// recalculating loyalty tiers, recording point transactions, and publishing
// tier-upgrade notifications to the message broker.

using RewardService.DTOs;
using RewardService.Models;
using RewardService.Repositories;

namespace RewardService.Services;

// Contract that controllers and other services depend on.
// Keeping this as an interface allows unit tests to inject fakes.
public interface IRewardService
{
    Task<ApiResponse<RewardResponse>> GetOrCreateRewardAsync(Guid userId);
    Task<ApiResponse<RewardResponse>> AddPointsAsync(Guid userId, int points, string reason, string reference);
    Task<ApiResponse<List<RewardTransactionResponse>>> GetHistoryAsync(Guid userId);
}

// Concrete implementation registered as a scoped service so each HTTP request
// gets its own instance (and therefore its own EF DbContext via the repository).
public class RewardService : IRewardService
{
    // Repository abstracts all database reads/writes for reward data.
    private readonly IRewardRepository _repo;

    // Message broker publisher used to fire tier-upgrade notifications
    // to the NotificationService without a direct HTTP dependency.
    private readonly IRabbitMqPublisher _mq;

    // Constructor injection — both dependencies are provided by the DI container.
    public RewardService(IRewardRepository repo, IRabbitMqPublisher mq)
    {
        _repo = repo;
        _mq = mq;
    }

    // Returns the reward record for the given user, creating one with zero balance
    // if it doesn't exist yet. This "get-or-create" pattern means the frontend
    // never receives a 404 — new users always start with a valid Bronze account.
    public async Task<ApiResponse<RewardResponse>> GetOrCreateRewardAsync(Guid userId)
    {
        // Try to load an existing reward record from the database.
        var reward = await _repo.GetRewardByUserIdAsync(userId);

        // If no record exists, this is the user's first interaction with the rewards system.
        if (reward == null)
        {
            // Initialise a new reward account at Bronze tier with zero points.
            reward = new Reward
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                PointsBalance = 0,   // No points earned yet.
                TotalEarned = 0,     // Lifetime total used for tier calculation.
                Tier = "Bronze",     // Everyone starts at Bronze.
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await _repo.AddRewardAsync(reward);
            await _repo.SaveChangesAsync();
        }

        // Map the domain model to the DTO before returning to avoid leaking internal fields.
        return new ApiResponse<RewardResponse>(true, "OK", MapReward(reward));
    }

    // Credits the specified number of points to the user's reward account.
    // Also recalculates the loyalty tier based on lifetime earnings and
    // publishes a notification if the tier changes.
    // The 'reference' parameter is the originating transaction ID, used by callers
    // for idempotency checks before calling this method.
    public async Task<ApiResponse<RewardResponse>> AddPointsAsync(
        Guid userId, int points, string reason, string reference)
    {
        // Load the existing reward record so we can update it.
        var reward = await _repo.GetRewardByUserIdAsync(userId);

        // If the user has no reward record yet, create one before crediting points.
        // This handles the edge case where points are awarded before the user has
        // ever visited the rewards page (which would normally trigger get-or-create).
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

        // Add the new points to both the spendable balance and the lifetime total.
        // PointsBalance can be spent/redeemed; TotalEarned only ever increases
        // and is the basis for tier calculation.
        reward.PointsBalance += points;
        reward.TotalEarned += points;
        reward.UpdatedAt = DateTime.UtcNow;

        // Capture the tier before recalculation so we can detect a change.
        var oldTier = reward.Tier;

        // Recalculate tier based on lifetime points earned.
        // Thresholds: 1000 points = Silver, 5000 points = Gold.
        reward.Tier = reward.TotalEarned switch
        {
            >= 5000 => "Gold",
            >= 1000 => "Silver",
            _ => "Bronze"
        };

        // Record an immutable audit entry for this points credit so users can
        // see exactly why and when they earned points.
        var tx = new RewardTransaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Points = points,
            Reason = reason,       // e.g. "transfer_completed", "campaign:SUMMER2025"
            Reference = reference, // The originating transaction reference for traceability.
            CreatedAt = DateTime.UtcNow
        };

        await _repo.AddRewardTransactionAsync(tx);
        await _repo.SaveChangesAsync();

        // If the tier changed, publish a notification so the user is informed immediately.
        // This is fire-and-forget via RabbitMQ — a failure here does not roll back the points.
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

    // Returns the last 50 point transactions for the user, newest first.
    // Capped at 50 to keep response sizes manageable; pagination can be added later.
    public async Task<ApiResponse<List<RewardTransactionResponse>>> GetHistoryAsync(Guid userId)
    {
        // Fetch raw transaction records from the database.
        var transactions = await _repo.GetRewardHistoryAsync(userId);

        // Project each domain model to a DTO, stripping internal fields.
        var result = transactions.Select(t => new RewardTransactionResponse(
            t.Id, t.Points, t.Reason, t.Reference, t.CreatedAt
        )).ToList();

        return new ApiResponse<List<RewardTransactionResponse>>(true, "OK", result);
    }

    // Maps the Reward domain model to the RewardResponse DTO.
    // Kept as a private static helper to centralise the mapping logic and
    // avoid duplicating field assignments across multiple methods.
    private static RewardResponse MapReward(Reward reward) =>
        new(reward.Id, reward.UserId, reward.PointsBalance, reward.TotalEarned, reward.Tier, reward.UpdatedAt);
}
