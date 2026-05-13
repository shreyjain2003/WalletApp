using System;
using System.Collections.Generic;
using AdminService.Models;
using Microsoft.EntityFrameworkCore;

namespace AdminService.Data;

// EF Core DbContext for the AdminService database.
// This is the single entry point for all database operations in this service.
// It owns two tables: KycReviews and SupportTickets.
// Schema constraints (column types, defaults, indexes) are defined in
// OnModelCreating using the Fluent API to keep the model classes clean.
public partial class AdminDbContext : DbContext
{
    // Parameterless constructor required by EF Core tooling (migrations, scaffolding).
    // Not used at runtime — the DI container always calls the options constructor.
    public AdminDbContext()
    {
    }

    // Primary constructor used by the DI container.
    // Options (connection string, provider) are configured in Program.cs and
    // injected here so the context is fully configured before any query runs.
    public AdminDbContext(DbContextOptions<AdminDbContext> options)
        : base(options)
    {
    }

    // Exposes the KycReviews table as a queryable/writable EF Core set.
    // One row per user — enforced by the unique index configured below.
    public virtual DbSet<KycReview> KycReviews { get; set; }

    // Exposes the SupportTickets table as a queryable/writable EF Core set.
    // Multiple tickets per user are allowed; no uniqueness constraint on UserId.
    public virtual DbSet<SupportTicket> SupportTickets { get; set; }

    // Fluent API configuration for both entities.
    // Called once by EF Core when the model is first built (cached afterwards).
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ── KycReview entity configuration ─────────────────────────────────
        modelBuilder.Entity<KycReview>(entity =>
        {
            // Named primary key constraint — matches the existing SQL Server name
            // so EF migrations don't try to rename it on every update.
            entity.HasKey(e => e.Id).HasName("PK__KycRevie__3214EC071170181A");

            // Unique index on UserId ensures one user can only have one KYC review
            // record at a time. Re-submissions update the existing row rather than
            // inserting a new one (handled in KycSubmissionConsumer).
            entity.HasIndex(e => e.UserId, "UQ_KycReviews_UserId").IsUnique();

            // Let SQL Server generate the GUID on insert.
            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");

            // AdminNote is optional but capped at 500 chars to prevent abuse.
            entity.Property(e => e.AdminNote).HasMaxLength(500);

            // DocumentNumber is capped at 100 chars — sufficient for all known
            // Indian identity document formats (Aadhaar, PAN, Passport, etc.).
            entity.Property(e => e.DocumentNumber).HasMaxLength(100);

            // DocumentType is a short label like "Passport" or "Aadhaar".
            entity.Property(e => e.DocumentType).HasMaxLength(50);

            // Status defaults to "Pending" at the DB level so a new row is always
            // in a valid state even if the application forgets to set it.
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Pending");

            // SQL Server sets SubmittedAt to the current UTC time on insert.
            entity.Property(e => e.SubmittedAt).HasDefaultValueSql("(getutcdate())");

            // UserEmail and UserFullName are capped to match typical auth system limits.
            entity.Property(e => e.UserEmail).HasMaxLength(256);
            entity.Property(e => e.UserFullName).HasMaxLength(200);
        });

        // ── SupportTicket entity configuration ─────────────────────────────
        modelBuilder.Entity<SupportTicket>(entity =>
        {
            // Named primary key constraint — matches the existing SQL Server name.
            entity.HasKey(e => e.Id).HasName("PK__SupportT__3214EC075BE2D353");

            // Let SQL Server generate the GUID on insert.
            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");

            // SQL Server sets CreatedAt to the current UTC time on insert.
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");

            // Status defaults to "Open" at the DB level so a new ticket is always
            // in a valid state even if the application forgets to set it.
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Open");

            // Subject is capped at 300 chars — long enough for a meaningful summary
            // but short enough to display cleanly in the admin ticket list.
            entity.Property(e => e.Subject).HasMaxLength(300);

            // UserEmail is capped to match the standard email field length.
            entity.Property(e => e.UserEmail).HasMaxLength(256);
        });

        // Partial method hook — allows generated or hand-written partial classes
        // to add extra configuration without modifying this scaffolded file.
        OnModelCreatingPartial(modelBuilder);
    }

    // Partial method declaration — implemented in a separate partial class file
    // if additional model configuration is needed beyond what is scaffolded here.
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
