// ============================================================
// AuthDbContext.cs — AuthService
// ------------------------------------------------------------
// Entity Framework Core database context for the AuthService.
// This class is the bridge between C# entity classes and the
// SQL Server database tables. EF Core uses it to:
//   - Generate SQL queries from LINQ expressions
//   - Track changes to entities and generate UPDATE/INSERT/DELETE SQL
//   - Manage database connections (pooled via DI)
//
// Tables managed by this context:
//   Users                — registered user accounts
//   KycDocuments         — identity verification documents
//   PasswordResetSessions — OTP and reset-token sessions for password reset
//   TransactionPins      — BCrypt-hashed transaction PINs
//
// Note: TransactionPins and PasswordResetSessions tables are created
// by raw SQL in Program.cs startup (not via EF migrations) because
// they were added after the initial schema was deployed.
// ============================================================

using System;
using System.Collections.Generic;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Data;

// DbContext is the EF Core unit-of-work and repository combined.
// Registered as Scoped in Program.cs — one instance per HTTP request.
// partial class allows the generated OnModelCreatingPartial hook to be
// implemented in a separate file if needed.
public partial class AuthDbContext : DbContext
{
    // Parameterless constructor required by EF Core tooling (migrations, scaffolding).
    public AuthDbContext()
    {
    }

    // Constructor used by the DI container — receives the connection string
    // and other options configured in Program.cs via AddDbContext<AuthDbContext>.
    public AuthDbContext(DbContextOptions<AuthDbContext> options)
        : base(options)
    {
    }

    // ── DbSets ───────────────────────────────────────────────────────────────
    // Each DbSet<T> maps to a SQL Server table and provides LINQ query access.
    // EF Core uses the property name to determine the table name by convention
    // (e.g. KycDocuments → [KycDocuments] table).

    // Maps to the [KycDocuments] table — one row per user's identity document.
    public virtual DbSet<KycDocument> KycDocuments { get; set; }

    // Maps to the [Users] table — core user account data.
    public virtual DbSet<User> Users { get; set; }

    // Maps to the [PasswordResetSessions] table — OTP and reset-token sessions.
    public virtual DbSet<PasswordResetSession> PasswordResetSessions { get; set; }

    // Maps to the [TransactionPins] table — BCrypt-hashed transaction PINs.
    public virtual DbSet<TransactionPin> TransactionPins { get; set; }

    // ── OnModelCreating ──────────────────────────────────────────────────────
    // Called once when the DbContext is first used to configure the EF Core model.
    // This is where we define primary keys, unique indexes, column constraints,
    // default values, and relationships that cannot be inferred by convention.
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ── KycDocuments table configuration ─────────────────────────────────
        modelBuilder.Entity<KycDocument>(entity =>
        {
            // Named primary key constraint (matches the SQL Server constraint name).
            entity.HasKey(e => e.Id).HasName("PK__KycDocum__3214EC074C3B2B2E");

            // Each user can have at most one KYC document — enforce with a unique index.
            entity.HasIndex(e => e.UserId, "UQ_Kyc_UserId").IsUnique();

            // Default value: SQL Server generates a new GUID if Id is not supplied.
            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");

            // Column length constraints to match the SQL Server schema.
            entity.Property(e => e.AdminNote).HasMaxLength(500);
            entity.Property(e => e.DocumentNumber).HasMaxLength(100);
            entity.Property(e => e.DocumentType).HasMaxLength(50);

            // Default status is "Pending" — set by SQL Server if not provided.
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Pending");

            // Default submission timestamp — set by SQL Server to current UTC time.
            entity.Property(e => e.SubmittedAt).HasDefaultValueSql("(getutcdate())");

            // One-to-one relationship: each KycDocument belongs to exactly one User.
            // HasForeignKey<KycDocument>(d => d.UserId) — UserId is the FK column.
            entity.HasOne(d => d.User).WithOne(p => p.KycDocument)
                .HasForeignKey<KycDocument>(d => d.UserId)
                .HasConstraintName("FK_Kyc_Users");
        });

        // ── Users table configuration ─────────────────────────────────────────
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Users__3214EC077A461828");

            // Email must be unique across all users.
            entity.HasIndex(e => e.Email, "UQ_Users_Email").IsUnique();

            // Phone number must also be unique.
            entity.HasIndex(e => e.PhoneNumber, "UQ_Users_Phone").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.FullName).HasMaxLength(200);
            entity.Property(e => e.PhoneNumber).HasMaxLength(20);

            // Default role is "User" — admins are seeded manually in Program.cs.
            entity.Property(e => e.Role)
                .HasMaxLength(20)
                .HasDefaultValue("User");

            // Default status is "Pending" — becomes "Active" after KYC approval.
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Pending");
        });

        // ── PasswordResetSessions table configuration ─────────────────────────
        modelBuilder.Entity<PasswordResetSession>(entity =>
        {
            entity.HasKey(e => e.Id);

            // Composite index for fast lookup by user + purpose + creation time.
            entity.HasIndex(e => new { e.UserId, e.Purpose, e.CreatedAtUtc });

            // Index for cleanup queries that find expired sessions by purpose.
            entity.HasIndex(e => new { e.Purpose, e.OtpExpiresAtUtc });

            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.Purpose).HasMaxLength(40);
            entity.Property(e => e.OtpHash).HasMaxLength(200);
            entity.Property(e => e.ResetTokenHash).HasMaxLength(200);
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(getutcdate())");

            // Cascade delete: when a User is deleted, all their reset sessions are deleted too.
            entity.HasOne(d => d.User)
                .WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_PasswordResetSession_User");
        });

        // ── TransactionPins table configuration ───────────────────────────────
        modelBuilder.Entity<TransactionPin>(entity =>
        {
            // UserId is both the primary key and the foreign key — one PIN per user.
            entity.HasKey(e => e.UserId);

            entity.Property(e => e.PinHash).HasMaxLength(200);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            // One-to-one relationship with User. Cascade delete removes the PIN
            // when the user account is deleted.
            entity.HasOne(d => d.User)
                .WithOne()
                .HasForeignKey<TransactionPin>(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_TransactionPin_User");
        });

        // Hook for partial class extensions (generated code pattern).
        OnModelCreatingPartial(modelBuilder);
    }

    // Partial method hook — can be implemented in another partial class file
    // to add additional model configuration without modifying this file.
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
