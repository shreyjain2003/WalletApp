namespace RewardService.Models;

public partial class CampaignRedemption
{
    public Guid Id { get; set; }

    public Guid CampaignId { get; set; }

    public Guid UserId { get; set; }

    public string TransactionRef { get; set; } = null!;

    public string TransactionType { get; set; } = null!;

    public decimal TransactionAmount { get; set; }

    public string RewardType { get; set; } = null!;

    public int RewardPoints { get; set; }

    public decimal CashbackAmount { get; set; }

    public string? Note { get; set; }

    public DateTime AppliedAtUtc { get; set; }

    public virtual Campaign Campaign { get; set; } = null!;
}
