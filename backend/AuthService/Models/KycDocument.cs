// KycDocument.cs
// Entity model representing a Know-Your-Customer (KYC) submission made by a user.
// KYC is a regulatory requirement: before a user can transact, they must prove
// their identity by submitting a government-issued document.
// This record tracks the document details and the admin's review decision.
// Mapped to the [KycDocuments] table in SQL Server by EF Core.

using System;
using System.Collections.Generic;

namespace AuthService.Models;

// Marked partial to allow EF Core scaffolding to regenerate without
// overwriting any hand-written additions.
public partial class KycDocument
{
    // Primary key — GUID to avoid sequential enumeration of document IDs.
    public Guid Id { get; set; }

    // Foreign key linking this document to its owner in the [Users] table.
    // The relationship is one-to-one: each user can have at most one KYC record.
    // If the user is deleted, this row is also deleted (CASCADE).
    public Guid UserId { get; set; }

    // The category of identity document submitted (e.g. "Aadhaar", "PAN", "Passport").
    // Stored as a free-form string so new document types can be added without
    // a schema migration.
    public string DocumentType { get; set; } = null!;

    // The unique identifier printed on the document (e.g. Aadhaar number, PAN number).
    // Used by the admin to cross-check the physical document.
    public string DocumentNumber { get; set; } = null!;

    // Current review status of this KYC submission:
    //   "Pending"  — submitted, awaiting admin review
    //   "Approved" — admin accepted the document; user.Status becomes "Active"
    //   "Rejected" — admin rejected the document; user.Status becomes "Rejected"
    // Defaults to "Pending" at the database level.
    public string Status { get; set; } = null!;

    // Optional note left by the admin explaining their decision,
    // especially useful when rejecting so the user knows what to fix.
    // Null until the admin reviews the submission.
    public string? AdminNote { get; set; }

    // UTC timestamp of when the user submitted (or re-submitted) this document.
    // Defaults to the current UTC time at the database level.
    public DateTime SubmittedAt { get; set; }

    // UTC timestamp of when an admin reviewed the submission.
    // Null until a review decision is made.
    public DateTime? ReviewedAt { get; set; }

    // Navigation property — EF Core populates this with the owning User row
    // when the query uses .Include(k => k.User).
    // Non-nullable because a KYC document cannot exist without a user.
    public virtual User User { get; set; } = null!;
}
