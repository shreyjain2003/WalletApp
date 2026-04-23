using System;
using System.Collections.Generic;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Data;

public partial class AuthDbContext : DbContext
{
    public AuthDbContext()
    {
    }

    public AuthDbContext(DbContextOptions<AuthDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<KycDocument> KycDocuments { get; set; }

    public virtual DbSet<User> Users { get; set; }
    public virtual DbSet<PasswordResetSession> PasswordResetSessions { get; set; }
    public virtual DbSet<TransactionPin> TransactionPins { get; set; }

    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<KycDocument>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__KycDocum__3214EC074C3B2B2E");

            entity.HasIndex(e => e.UserId, "UQ_Kyc_UserId").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.AdminNote).HasMaxLength(500);
            entity.Property(e => e.DocumentNumber).HasMaxLength(100);
            entity.Property(e => e.DocumentType).HasMaxLength(50);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Pending");
            entity.Property(e => e.SubmittedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.User).WithOne(p => p.KycDocument)
                .HasForeignKey<KycDocument>(d => d.UserId)
                .HasConstraintName("FK_Kyc_Users");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Users__3214EC077A461828");

            entity.HasIndex(e => e.Email, "UQ_Users_Email").IsUnique();

            entity.HasIndex(e => e.PhoneNumber, "UQ_Users_Phone").IsUnique();

            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.FullName).HasMaxLength(200);
            entity.Property(e => e.PhoneNumber).HasMaxLength(20);
            entity.Property(e => e.Role)
                .HasMaxLength(20)
                .HasDefaultValue("User");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Pending");
        });

        modelBuilder.Entity<PasswordResetSession>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => new { e.UserId, e.Purpose, e.CreatedAtUtc });
            entity.HasIndex(e => new { e.Purpose, e.OtpExpiresAtUtc });

            entity.Property(e => e.Id).HasDefaultValueSql("(newid())");
            entity.Property(e => e.Purpose).HasMaxLength(40);
            entity.Property(e => e.OtpHash).HasMaxLength(200);
            entity.Property(e => e.ResetTokenHash).HasMaxLength(200);
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.User)
                .WithMany()
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_PasswordResetSession_User");
        });

        modelBuilder.Entity<TransactionPin>(entity =>
        {
            entity.HasKey(e => e.UserId);

            entity.Property(e => e.PinHash).HasMaxLength(200);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.User)
                .WithOne()
                .HasForeignKey<TransactionPin>(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_TransactionPin_User");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
