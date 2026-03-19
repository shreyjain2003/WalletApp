using System;
using System.Collections.Generic;

namespace WalletService.Models;

public partial class WalletTransaction
{
    public Guid Id { get; set; }

    public Guid WalletId { get; set; }

    public Guid? ToWalletId { get; set; }

    public string Type { get; set; } = null!;

    public decimal Amount { get; set; }

    public decimal BalanceAfter { get; set; }

    public string Status { get; set; } = null!;

    public string Reference { get; set; } = null!;

    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Wallet Wallet { get; set; } = null!;
}
