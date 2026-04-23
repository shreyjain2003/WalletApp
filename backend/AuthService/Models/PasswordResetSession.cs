namespace AuthService.Models;

public partial class PasswordResetSession
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string Purpose { get; set; } = null!;

    public string OtpHash { get; set; } = null!;

    public string? ResetTokenHash { get; set; }

    public DateTime OtpExpiresAtUtc { get; set; }

    public DateTime? ResetTokenExpiresAtUtc { get; set; }

    public DateTime? VerifiedAtUtc { get; set; }

    public DateTime? UsedAtUtc { get; set; }

    public int Attempts { get; set; }

    public int MaxAttempts { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? LastAttemptAtUtc { get; set; }

    public virtual User User { get; set; } = null!;
}
