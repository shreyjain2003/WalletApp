namespace RewardService.Models;

public partial class CampaignRule
{
    public Guid Id { get; set; }

    public Guid CampaignId { get; set; }

    public string TransactionType { get; set; } = null!;

    public decimal? MinAmount { get; set; }

    public decimal? MaxAmount { get; set; }

    public string RewardType { get; set; } = null!;

    public int RewardPoints { get; set; }

    public decimal CashbackAmount { get; set; }

    public decimal CashbackPercent { get; set; }

    public decimal MaxCashbackAmount { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public virtual Campaign Campaign { get; set; } = null!;
}
