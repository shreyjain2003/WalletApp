// TransactionPin.cs
// Entity model representing a user's 4-8 digit transaction PIN.
// The PIN is a second layer of security required before any money movement
// (transfers, payments) is allowed. It is separate from the login password
// so that even if a session token is stolen, the attacker still cannot
// initiate transactions without knowing the PIN.
// Mapped to the [TransactionPins] table in SQL Server.
// Note: this table is created via raw SQL in Program.cs (not via EF migrations)
// because it was added after the initial schema was deployed.

namespace AuthService.Models;

public class TransactionPin
{
    // Primary key AND foreign key to the [Users] table.
    // Using UserId as the PK enforces the one-to-one relationship at the
    // database level — a user can have at most one PIN record.
    public Guid UserId { get; set; }

    // BCrypt hash of the user's PIN.
    // The raw PIN digits are never stored — only this hash — so a database
    // breach does not expose PINs directly.
    public string PinHash { get; set; } = null!;

    // UTC timestamp of when the PIN was first set.
    // Useful for auditing and for prompting users to rotate old PINs.
    public DateTime CreatedAt { get; set; }

    // UTC timestamp of the most recent PIN change.
    // Updated every time SetPinAsync is called, whether it is a new PIN
    // or a change to an existing one.
    public DateTime UpdatedAt { get; set; }

    // Navigation property — EF Core populates this with the owning User row.
    // Non-nullable because a PIN record cannot exist without a user.
    public virtual User User { get; set; } = null!;
}
