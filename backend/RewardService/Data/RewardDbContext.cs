using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using RewardService.Models;

namespace RewardService.Data;

public partial class RewardDbContext : DbContext
{
    public RewardDbContext()
    {
    }

    public RewardDbContext(DbContextOptions<RewardDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Reward> Rewards { get; set; }

    public virtual DbSet<RewardTransaction> RewardTransactions { get; set; }

    public virtual DbSet<Campaign> Campaigns { get; set; }

    public virtual DbSet<CampaignRule> CampaignRules { get; set; }

    public virtual DbSet<CampaignRedemption> CampaignRedemptions { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Reward>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Rewards__3214EC0753939E0F");

            entity.HasIndex(e => e.UserId, "UQ_Rewards_UserId").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Tier)
                .HasMaxLength(20)
                .HasDefaultValue("Bronze");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");
        });

        modelBuilder.Entity<RewardTransaction>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__RewardTr__3214EC072B465DB3");

            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Reason).HasMaxLength(100);
            entity.Property(e => e.Reference).HasMaxLength(100);
        });

        modelBuilder.Entity<Campaign>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.Code).IsUnique();
            entity.HasIndex(e => new { e.IsActive, e.StartAtUtc, e.EndAtUtc });

            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.Name).HasMaxLength(120);
            entity.Property(e => e.Code).HasMaxLength(40);
            entity.Property(e => e.Description).HasMaxLength(400);
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.UpdatedAtUtc).HasDefaultValueSql("(getutcdate())");
        });

        modelBuilder.Entity<CampaignRule>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => new { e.CampaignId, e.TransactionType, e.IsActive });
            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.TransactionType).HasMaxLength(40);
            entity.Property(e => e.RewardType).HasMaxLength(40);
            entity.Property(e => e.MinAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.MaxAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.CashbackAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.CashbackPercent).HasColumnType("decimal(9,4)");
            entity.Property(e => e.MaxCashbackAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.UpdatedAtUtc).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Campaign)
                .WithMany(p => p.Rules)
                .HasForeignKey(d => d.CampaignId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CampaignRedemption>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => new { e.CampaignId, e.TransactionRef }).IsUnique();
            entity.HasIndex(e => new { e.UserId, e.AppliedAtUtc });

            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.TransactionRef).HasMaxLength(120);
            entity.Property(e => e.TransactionType).HasMaxLength(40);
            entity.Property(e => e.TransactionAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.RewardType).HasMaxLength(40);
            entity.Property(e => e.CashbackAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Note).HasMaxLength(300);
            entity.Property(e => e.AppliedAtUtc).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Campaign)
                .WithMany(p => p.Redemptions)
                .HasForeignKey(d => d.CampaignId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
