using System;
using System.Collections.Generic;

namespace RewardService.Models;

public partial class RewardTransaction
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public int Points { get; set; }

    public string Reason { get; set; } = null!;

    public string Reference { get; set; } = null!;

    public DateTime CreatedAt { get; set; }
}
