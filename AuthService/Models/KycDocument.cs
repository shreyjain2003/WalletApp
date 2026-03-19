using System;
using System.Collections.Generic;

namespace AuthService.Models;

public partial class KycDocument
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string DocumentType { get; set; } = null!;

    public string DocumentNumber { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? AdminNote { get; set; }

    public DateTime SubmittedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
