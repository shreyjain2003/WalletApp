namespace AuthService.Models;

public class TransactionPin
{
    public Guid UserId { get; set; }
    public string PinHash { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
