using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using WalletService.Models;

namespace WalletService.Data;

// EF Core DbContext for the WalletService database.
// This is the single entry point for all database operations in this service.
// It owns two tables: Wallets and WalletTransactions.
// Schema constraints (column types, defaults, indexes, FK rules) are defined
// in OnModelCreating rather than data annotations to keep the model classes clean.
public partial class WalletDbContext : DbContext
{
    // Parameterless constructor required by EF Core tooling (migrations, scaffolding).
    // Not used at runtime — the DI container always calls the options constructor.
    public WalletDbContext()
    {
    }

    // Primary constructor used by the DI container.
    // Options (connection string, provider) are configured in Program.cs and
    // injected here so the context is fully configured before any query runs.
    public WalletDbContext(DbContextOptions<WalletDbContext> options)
        : base(options)
    {
    }

    // Exposes the Wallets table as a queryable/writable EF Core set.
    // One row per user — enforced by the unique index configured below.
    public virtual DbSet<Wallet> Wallets { get; set; }

    // Exposes the WalletTransactions table as a queryable/writable EF Core set.
    // Every financial event (top-up, transfer, cashback, adjustment) produces a row here.
    public virtual DbSet<WalletTransaction> WalletTransactions { get; set; }

    // Fluent API configuration for both entities.
    // Called once by EF Core when the model is first built (cached afterwards).
    // Using Fluent API here instead of attributes keeps the model POCOs clean
    // and makes it easier to see all schema rules in one place.
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ── Wallet entity configuration ────────────────────────────────────
        modelBuilder.Entity<Wallet>(entity =>
        {
            // Named primary key constraint — matches the SQL Server default name
            // so EF migrations don't try to rename it on every update.
            entity.HasKey(e => e.Id).HasName("PK__Wallets__3214EC07DC769CED");

            // Unique index on UserId ensures one user can never have two wallets.
            // This is the business rule enforced at the database level as a safety net.
            entity.HasIndex(e => e.UserId, "UQ_Wallets_UserId").IsUnique();

            // Let SQL Server generate the GUID so inserts don't need an explicit Id.
            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");

            // decimal(18,2) avoids floating-point rounding errors on monetary values.
            entity.Property(e => e.Balance).HasColumnType("decimal(18, 2)");

            // SQL Server sets CreatedAt to the current UTC time on insert.
            // The application never needs to supply this value explicitly.
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");

            // Currency defaults to "INR" at the DB level so existing rows are
            // never null even if the application forgets to set it.
            entity.Property(e => e.Currency)
                .HasMaxLength(10)
                .HasDefaultValue("INR");

            // UpdatedAt also defaults to now on insert; the application must
            // update it explicitly on every subsequent write.
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");
        });

        // ── WalletTransaction entity configuration ─────────────────────────
        modelBuilder.Entity<WalletTransaction>(entity =>
        {
            // Named primary key constraint — matches the existing SQL Server name.
            entity.HasKey(e => e.Id).HasName("PK__WalletTr__3214EC0735794CA5");

            // Unique index on Reference prevents duplicate reference codes from
            // being inserted even under concurrent requests.
            entity.HasIndex(e => e.Reference, "UQ_Transactions_Reference").IsUnique();

            // Let SQL Server generate the GUID on insert.
            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");

            // Both Amount and BalanceAfter use decimal(18,2) for monetary precision.
            entity.Property(e => e.Amount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.BalanceAfter).HasColumnType("decimal(18, 2)");

            // SQL Server sets CreatedAt on insert; transactions are immutable so
            // this value is never changed after the row is written.
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");

            // Note is optional (nullable) but capped at 500 chars to prevent abuse.
            entity.Property(e => e.Note).HasMaxLength(500);

            // Reference codes are short enough to fit in 100 chars
            // (prefix + timestamp + 12-char GUID fragment).
            entity.Property(e => e.Reference).HasMaxLength(100);

            // Status defaults to "Success" at the DB level so a missing value
            // never leaves a transaction in an ambiguous state.
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Success");

            // Type values are short strings like "topup", "transfer_out", etc.
            entity.Property(e => e.Type).HasMaxLength(30);

            // FK relationship: each transaction belongs to exactly one wallet.
            // ClientSetNull means EF won't try to null the FK on the client side
            // if the wallet is deleted — the DB constraint handles it instead.
            entity.HasOne(d => d.Wallet).WithMany(p => p.WalletTransactions)
                .HasForeignKey(d => d.WalletId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Transactions_Wallet");
        });

        // Partial method hook — allows generated or hand-written partial classes
        // to add extra configuration without modifying this scaffolded file.
        OnModelCreatingPartial(modelBuilder);
    }

    // Partial method declaration — implemented in a separate partial class file
    // if additional model configuration is needed beyond what is scaffolded here.
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
