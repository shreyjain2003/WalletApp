using Microsoft.EntityFrameworkCore;
using RewardService.DTOs;
using RewardService.Models;
using RewardService.Repositories;

namespace RewardService.Services;

public interface ICampaignService
{
    Task<ApiResponse<List<CampaignResponse>>> GetAllCampaignsAsync();
    Task<ApiResponse<List<CampaignResponse>>> GetAvailableCampaignsAsync();
    Task<ApiResponse<CampaignResponse>> CreateCampaignAsync(CreateCampaignRequest request);
    Task<ApiResponse<CampaignResponse>> AddRuleAsync(Guid campaignId, AddCampaignRuleRequest request);
    Task<ApiResponse<List<CampaignRedemptionResponse>>> GetMyRedemptionsAsync(Guid userId);
    Task<ApiResponse<int>> EvaluateAndApplyAsync(Guid userId, string transactionType, decimal amount, string transactionRef);
}

public class CampaignService : ICampaignService
{
    private const string RewardTypePoints = "POINTS";
    private const string RewardTypeCashback = "CASHBACK";
    private const string RewardTypeOffer = "OFFER";

    private readonly ICampaignRepository _campaignRepo;
    private readonly IRewardRepository _rewardRepo;
    private readonly IRabbitMqPublisher _mq;

    public CampaignService(
        ICampaignRepository campaignRepo,
        IRewardRepository rewardRepo,
        IRabbitMqPublisher mq)
    {
        _campaignRepo = campaignRepo;
        _rewardRepo = rewardRepo;
        _mq = mq;
    }

    public async Task<ApiResponse<List<CampaignResponse>>> GetAllCampaignsAsync()
    {
        var campaigns = await _campaignRepo.GetAllCampaignsAsync();
        return new ApiResponse<List<CampaignResponse>>(true, "OK", campaigns.Select(MapCampaign).ToList());
    }

    public async Task<ApiResponse<List<CampaignResponse>>> GetAvailableCampaignsAsync()
    {
        // Returns only currently active campaigns that haven't expired — for user browsing
        var now = DateTime.UtcNow;
        var campaigns = await _campaignRepo.GetAllCampaignsAsync();
        var available = campaigns
            .Where(c => c.IsActive && c.StartAtUtc <= now && c.EndAtUtc >= now && c.Rules.Any(r => r.IsActive))
            .OrderByDescending(c => c.Priority)
            .ToList();
        return new ApiResponse<List<CampaignResponse>>(true, "OK", available.Select(MapCampaign).ToList());
    }

    public async Task<ApiResponse<CampaignResponse>> CreateCampaignAsync(CreateCampaignRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return new ApiResponse<CampaignResponse>(false, "Campaign name is required.", null);
        if (string.IsNullOrWhiteSpace(request.Code))
            return new ApiResponse<CampaignResponse>(false, "Campaign code is required.", null);
        if (request.EndAtUtc <= request.StartAtUtc)
            return new ApiResponse<CampaignResponse>(false, "Campaign end time must be after start time.", null);

        var campaign = new Campaign
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Code = request.Code.Trim().ToUpperInvariant(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsActive = request.IsActive,
            Priority = request.Priority,
            StartAtUtc = request.StartAtUtc,
            EndAtUtc = request.EndAtUtc,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        await _campaignRepo.AddCampaignAsync(campaign);
        await _campaignRepo.SaveChangesAsync();

        var reloaded = await _campaignRepo.GetCampaignByIdAsync(campaign.Id) ?? campaign;
        return new ApiResponse<CampaignResponse>(true, "Campaign created.", MapCampaign(reloaded));
    }

    public async Task<ApiResponse<CampaignResponse>> AddRuleAsync(Guid campaignId, AddCampaignRuleRequest request)
    {
        var campaign = await _campaignRepo.GetCampaignByIdAsync(campaignId);
        if (campaign == null)
            return new ApiResponse<CampaignResponse>(false, "Campaign not found.", null);

        var transactionType = NormalizeTransactionType(request.TransactionType);
        if (transactionType == null)
            return new ApiResponse<CampaignResponse>(false, "Invalid transaction type.", null);

        var rewardType = NormalizeRewardType(request.RewardType);
        if (rewardType == null)
            return new ApiResponse<CampaignResponse>(false, "Invalid reward type. Use POINTS, CASHBACK or OFFER.", null);

        if (request.MinAmount.HasValue && request.MaxAmount.HasValue
            && request.MinAmount.Value > request.MaxAmount.Value)
            return new ApiResponse<CampaignResponse>(false, "MinAmount cannot be greater than MaxAmount.", null);

        if (rewardType == RewardTypePoints && request.RewardPoints <= 0)
            return new ApiResponse<CampaignResponse>(false, "RewardPoints must be greater than 0 for POINTS rules.", null);

        if (rewardType == RewardTypeCashback
            && request.CashbackAmount <= 0
            && request.CashbackPercent <= 0)
            return new ApiResponse<CampaignResponse>(false, "Provide CashbackAmount or CashbackPercent for CASHBACK rules.", null);

        var rule = new CampaignRule
        {
            Id = Guid.NewGuid(),
            CampaignId = campaignId,
            TransactionType = transactionType,
            MinAmount = request.MinAmount,
            MaxAmount = request.MaxAmount,
            RewardType = rewardType,
            RewardPoints = request.RewardPoints,
            CashbackAmount = request.CashbackAmount,
            CashbackPercent = request.CashbackPercent,
            MaxCashbackAmount = request.MaxCashbackAmount,
            IsActive = request.IsActive,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        await _campaignRepo.AddRuleAsync(rule);
        campaign.UpdatedAtUtc = DateTime.UtcNow;
        await _campaignRepo.SaveChangesAsync();

        var reloaded = await _campaignRepo.GetCampaignByIdAsync(campaignId) ?? campaign;
        return new ApiResponse<CampaignResponse>(true, "Rule added.", MapCampaign(reloaded));
    }

    public async Task<ApiResponse<List<CampaignRedemptionResponse>>> GetMyRedemptionsAsync(Guid userId)
    {
        var redemptions = await _campaignRepo.GetRedemptionsByUserAsync(userId);
        var data = redemptions.Select(r => new CampaignRedemptionResponse(
            r.Id,
            r.CampaignId,
            r.Campaign.Code,
            r.Campaign.Name,
            r.TransactionRef,
            r.TransactionType,
            r.TransactionAmount,
            r.RewardType,
            r.RewardPoints,
            r.CashbackAmount,
            r.AppliedAtUtc
        )).ToList();

        return new ApiResponse<List<CampaignRedemptionResponse>>(true, "OK", data);
    }

    public async Task<ApiResponse<int>> EvaluateAndApplyAsync(Guid userId, string transactionType, decimal amount, string transactionRef)
    {
        if (userId == Guid.Empty)
            return new ApiResponse<int>(false, "UserId is required.", 0);
        if (string.IsNullOrWhiteSpace(transactionRef))
            return new ApiResponse<int>(false, "TransactionRef is required.", 0);
        if (amount <= 0)
            return new ApiResponse<int>(false, "Transaction amount must be greater than 0.", 0);

        var normalizedType = NormalizeTransactionType(transactionType);
        if (normalizedType == null)
            return new ApiResponse<int>(false, "Invalid transaction type.", 0);

        var campaigns = await _campaignRepo.GetActiveCampaignsAsync(normalizedType, DateTime.UtcNow);
        if (campaigns.Count == 0)
            return new ApiResponse<int>(true, "No eligible campaigns.", 0);

        var appliedCount = 0;
        foreach (var campaign in campaigns)
        {
            var matchingRules = campaign.Rules
                .Where(r => r.IsActive && r.TransactionType == normalizedType)
                .ToList();

            foreach (var rule in matchingRules)
            {
                if (!IsRuleEligible(rule, amount))
                    continue;

                var alreadyApplied = await _campaignRepo.RedemptionExistsAsync(campaign.Id, transactionRef);
                if (alreadyApplied)
                    break;

                var reward = await _rewardRepo.GetRewardByUserIdAsync(userId);
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
                    await _rewardRepo.AddRewardAsync(reward);
                }

                var rewardPoints = 0;
                var cashbackAmount = 0m;
                if (rule.RewardType == RewardTypePoints)
                {
                    rewardPoints = rule.RewardPoints;
                    reward.PointsBalance += rewardPoints;
                    reward.TotalEarned += rewardPoints;
                    reward.UpdatedAt = DateTime.UtcNow;
                    reward.Tier = reward.TotalEarned switch
                    {
                        >= 5000 => "Gold",
                        >= 1000 => "Silver",
                        _ => "Bronze"
                    };
                }
                else if (rule.RewardType == RewardTypeCashback)
                {
                    cashbackAmount = CalculateCashback(rule, amount);
                }

                if (rewardPoints > 0)
                {
                    await _rewardRepo.AddRewardTransactionAsync(new RewardTransaction
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        Points = rewardPoints,
                        Reason = $"campaign:{campaign.Code}",
                        Reference = $"{transactionRef}:{campaign.Code}",
                        CreatedAt = DateTime.UtcNow
                    });
                }

                await _campaignRepo.AddRedemptionAsync(new CampaignRedemption
                {
                    Id = Guid.NewGuid(),
                    CampaignId = campaign.Id,
                    UserId = userId,
                    TransactionRef = transactionRef,
                    TransactionType = normalizedType,
                    TransactionAmount = amount,
                    RewardType = rule.RewardType,
                    RewardPoints = rewardPoints,
                    CashbackAmount = cashbackAmount,
                    Note = $"Applied by rule {rule.Id}",
                    AppliedAtUtc = DateTime.UtcNow
                });

                try
                {
                    await _campaignRepo.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    // Handles race conditions for unique (CampaignId, TransactionRef).
                    continue;
                }

                appliedCount++;

                _mq.Publish("notifications", new
                {
                    UserId = userId.ToString(),
                    Title = $"Campaign Applied: {campaign.Name}",
                    Message = BuildCampaignMessage(campaign, rule.RewardType, rewardPoints, cashbackAmount, transactionRef),
                    Type = "campaign_applied"
                });

                if (cashbackAmount > 0)
                {
                    _mq.Publish("campaign_cashback", new
                    {
                        UserId = userId.ToString(),
                        TransactionRef = transactionRef,
                        CampaignCode = campaign.Code,
                        CashbackAmount = cashbackAmount
                    });
                }

                break;
            }
        }

        return new ApiResponse<int>(true, "Campaign evaluation completed.", appliedCount);
    }

    private static bool IsRuleEligible(CampaignRule rule, decimal amount)
    {
        if (rule.MinAmount.HasValue && amount < rule.MinAmount.Value)
            return false;
        if (rule.MaxAmount.HasValue && amount > rule.MaxAmount.Value)
            return false;
        return true;
    }

    private static decimal CalculateCashback(CampaignRule rule, decimal amount)
    {
        var cashback = rule.CashbackAmount;
        if (cashback <= 0 && rule.CashbackPercent > 0)
            cashback = amount * (rule.CashbackPercent / 100m);
        if (rule.MaxCashbackAmount > 0 && cashback > rule.MaxCashbackAmount)
            cashback = rule.MaxCashbackAmount;
        return Math.Round(cashback, 2);
    }

    private static string? NormalizeTransactionType(string transactionType)
    {
        var t = transactionType.Trim().ToLowerInvariant();
        return t switch
        {
            "topup" => "topup",
            "transfer_in" => "transfer_in",
            "transfer_out" => "transfer_out",
            _ => null
        };
    }

    private static string? NormalizeRewardType(string rewardType)
    {
        var r = rewardType.Trim().ToUpperInvariant();
        return r switch
        {
            RewardTypePoints => RewardTypePoints,
            RewardTypeCashback => RewardTypeCashback,
            RewardTypeOffer => RewardTypeOffer,
            _ => null
        };
    }

    private static string BuildCampaignMessage(
        Campaign campaign,
        string rewardType,
        int rewardPoints,
        decimal cashbackAmount,
        string transactionRef)
    {
        return rewardType switch
        {
            RewardTypePoints => $"{campaign.Name} applied on {transactionRef}. {rewardPoints} reward points credited.",
            RewardTypeCashback => $"{campaign.Name} applied on {transactionRef}. Cashback amount Rs. {cashbackAmount:0.00} is processed.",
            _ => $"{campaign.Name} offer applied on {transactionRef}."
        };
    }

    private static CampaignResponse MapCampaign(Campaign campaign) =>
        new(
            campaign.Id,
            campaign.Name,
            campaign.Code,
            campaign.Description,
            campaign.IsActive,
            campaign.Priority,
            campaign.StartAtUtc,
            campaign.EndAtUtc,
            campaign.Rules
                .OrderByDescending(r => r.CreatedAtUtc)
                .Select(r => new CampaignRuleResponse(
                    r.Id,
                    r.TransactionType,
                    r.MinAmount,
                    r.MaxAmount,
                    r.RewardType,
                    r.RewardPoints,
                    r.CashbackAmount,
                    r.CashbackPercent,
                    r.MaxCashbackAmount,
                    r.IsActive))
                .ToList()
        );
}
