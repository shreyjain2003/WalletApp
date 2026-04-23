namespace RewardService.Models;

public partial class Campaign
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public int Priority { get; set; }

    public DateTime StartAtUtc { get; set; }

    public DateTime EndAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public virtual ICollection<CampaignRule> Rules { get; set; } = new List<CampaignRule>();

    public virtual ICollection<CampaignRedemption> Redemptions { get; set; } = new List<CampaignRedemption>();
}
