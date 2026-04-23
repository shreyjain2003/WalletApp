using Microsoft.EntityFrameworkCore;
using RewardService.Data;
using RewardService.Models;

namespace RewardService.Repositories;

public interface ICampaignRepository
{
    Task<List<Campaign>> GetActiveCampaignsAsync(string transactionType, DateTime nowUtc);
    Task<Campaign?> GetCampaignByIdAsync(Guid campaignId);
    Task<List<Campaign>> GetAllCampaignsAsync();
    Task<List<CampaignRedemption>> GetRedemptionsByUserAsync(Guid userId, int take = 100);
    Task<bool> RedemptionExistsAsync(Guid campaignId, string transactionRef);
    Task AddCampaignAsync(Campaign campaign);
    Task AddRuleAsync(CampaignRule rule);
    Task AddRedemptionAsync(CampaignRedemption redemption);
    Task<int> SaveChangesAsync();
}

public class CampaignRepository : ICampaignRepository
{
    private readonly RewardDbContext _db;

    public CampaignRepository(RewardDbContext db)
    {
        _db = db;
    }

    public Task<List<Campaign>> GetActiveCampaignsAsync(string transactionType, DateTime nowUtc) =>
        _db.Campaigns
            .Include(c => c.Rules.Where(r => r.IsActive))
            .Where(c => c.IsActive
                && c.StartAtUtc <= nowUtc
                && c.EndAtUtc >= nowUtc
                && c.Rules.Any(r => r.IsActive && r.TransactionType == transactionType))
            .OrderByDescending(c => c.Priority)
            .ThenBy(c => c.StartAtUtc)
            .ToListAsync();

    public Task<Campaign?> GetCampaignByIdAsync(Guid campaignId) =>
        _db.Campaigns
            .Include(c => c.Rules.OrderByDescending(r => r.CreatedAtUtc))
            .FirstOrDefaultAsync(c => c.Id == campaignId);

    public Task<List<Campaign>> GetAllCampaignsAsync() =>
        _db.Campaigns
            .Include(c => c.Rules.OrderByDescending(r => r.CreatedAtUtc))
            .OrderByDescending(c => c.UpdatedAtUtc)
            .ToListAsync();

    public Task<List<CampaignRedemption>> GetRedemptionsByUserAsync(Guid userId, int take = 100) =>
        _db.CampaignRedemptions
            .Include(r => r.Campaign)
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.AppliedAtUtc)
            .Take(take)
            .ToListAsync();

    public Task<bool> RedemptionExistsAsync(Guid campaignId, string transactionRef) =>
        _db.CampaignRedemptions.AnyAsync(r =>
            r.CampaignId == campaignId && r.TransactionRef == transactionRef);

    public Task AddCampaignAsync(Campaign campaign) =>
        _db.Campaigns.AddAsync(campaign).AsTask();

    public Task AddRuleAsync(CampaignRule rule) =>
        _db.CampaignRules.AddAsync(rule).AsTask();

    public Task AddRedemptionAsync(CampaignRedemption redemption) =>
        _db.CampaignRedemptions.AddAsync(redemption).AsTask();

    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();
}
