// User.cs
// Entity model representing a registered user in the system.
// This class is mapped directly to the [Users] table in SQL Server by EF Core.
// It is the central entity — almost every other table (KycDocument,
// TransactionPin, PasswordResetSession) has a foreign key pointing here.

using System;
using System.Collections.Generic;

namespace AuthService.Models;

// Marked partial so EF Core scaffolding can regenerate the other half
// of the class without overwriting any hand-written customisations.
public partial class User
{
    // Primary key — a GUID rather than an int to avoid sequential ID enumeration
    // attacks and to make IDs safe to expose in URLs and JWTs.
    public Guid Id { get; set; }

    // The user's display name, shown in the UI and included in notifications.
    // null! tells the compiler "EF Core will always populate this from the DB".
    public string FullName { get; set; } = null!;

    // Unique email address used as the login identifier.
    // Stored in lowercase (normalised at the service layer) to prevent
    // duplicate accounts differing only in case.
    public string Email { get; set; } = null!;

    // Unique mobile number — validated at registration to be a 10-digit
    // Indian mobile number starting with 6-9.
    public string PhoneNumber { get; set; } = null!;

    // BCrypt hash of the user's password.
    // The plaintext password is NEVER stored — only this hash.
    // BCrypt is used because it is intentionally slow, making brute-force attacks expensive.
    public string PasswordHash { get; set; } = null!;

    // Role controls what the user can access: "User" or "Admin".
    // Stored in the JWT so downstream services can authorise without
    // calling back to AuthService on every request.
    public string Role { get; set; } = null!;

    // Lifecycle status of the account:
    //   "Pending"  — registered but KYC not yet approved
    //   "Active"   — KYC approved, full wallet access granted
    //   "Rejected" — KYC was rejected by an admin
    // Also stored in the JWT via the custom "status" claim.
    public string Status { get; set; } = null!;

    // UTC timestamp of when the account was created.
    // Used for auditing and for ordering users in admin lists.
    public DateTime CreatedAt { get; set; }

    // Navigation property — EF Core lazy/eager loads the related KycDocument row.
    // Nullable because a user may not have submitted KYC yet.
    // The relationship is one-to-one: one user → at most one KYC document.
    public virtual KycDocument? KycDocument { get; set; }
}
