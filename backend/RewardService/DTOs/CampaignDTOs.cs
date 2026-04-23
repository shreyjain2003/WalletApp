namespace RewardService.DTOs;

public record CampaignResponse(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    bool IsActive,
    int Priority,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    List<CampaignRuleResponse> Rules
);

public record CampaignRuleResponse(
    Guid Id,
    string TransactionType,
    decimal? MinAmount,
    decimal? MaxAmount,
    string RewardType,
    int RewardPoints,
    decimal CashbackAmount,
    decimal CashbackPercent,
    decimal MaxCashbackAmount,
    bool IsActive
);

public record CampaignRedemptionResponse(
    Guid Id,
    Guid CampaignId,
    string CampaignCode,
    string CampaignName,
    string TransactionRef,
    string TransactionType,
    decimal TransactionAmount,
    string RewardType,
    int RewardPoints,
    decimal CashbackAmount,
    DateTime AppliedAtUtc
);

public record CreateCampaignRequest(
    string Name,
    string Code,
    string? Description,
    bool IsActive,
    int Priority,
    DateTime StartAtUtc,
    DateTime EndAtUtc
);

public record AddCampaignRuleRequest(
    string TransactionType,
    decimal? MinAmount,
    decimal? MaxAmount,
    string RewardType,
    int RewardPoints,
    decimal CashbackAmount,
    decimal CashbackPercent,
    decimal MaxCashbackAmount,
    bool IsActive
);

public record EvaluateCampaignsRequest(
    Guid UserId,
    string TransactionType,
    decimal TransactionAmount,
    string TransactionRef
);
