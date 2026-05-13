// ============================================================
// AdminController.cs — AdminService
// ------------------------------------------------------------
// HTTP API for all admin and support-ticket operations.
//
// Admin-only routes (require Role = "Admin" JWT):
//   POST /api/admin/login           — admin authentication (proxied to AuthService)
//   GET  /api/admin/kyc/pending     — list pending KYC submissions for review
//   POST /api/admin/kyc/{id}/decide — approve or reject a KYC submission
//   GET  /api/admin/tickets         — list all support tickets
//   POST /api/admin/tickets/{id}/reply — reply to a support ticket
//
// User routes (require any valid JWT):
//   POST /api/admin/tickets/submit  — submit a new support ticket
//   GET  /api/admin/tickets/my      — get the current user's own tickets
//
// Note: /api/admin/login has no [Authorize] because the user is not
// yet authenticated when they call it. The service layer validates
// credentials by calling AuthService internally.
// ============================================================

using AdminService.Common.Exceptions;
using AdminService.DTOs;
using AdminService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AdminService.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    // IAdminService contains all business logic — KYC review, ticket management,
    // and HTTP calls to AuthService for user data.
    private readonly IAdminService _admin;

    public AdminController(IAdminService admin)
    {
        _admin = admin;
    }

    // Helper: extracts the authenticated admin's GUID from the JWT claims.
    // Used to record which admin performed a KYC decision or ticket reply.
    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    // ── POST /api/admin/login ────────────────────────────────────────────────
    // Admin login endpoint. No [Authorize] because the admin is not yet
    // authenticated. The service layer:
    //   1. Calls AuthService to verify the email is an Admin account.
    //   2. Calls AuthService /login to validate the password.
    //   3. Returns the JWT from AuthService so the admin panel can use it.
    // Returns 401 if credentials are wrong or the account is not an Admin.
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] AdminLoginRequest req)
    {
        var result = await _admin.LoginAsync(req);
        if (!result.Success) throw new UnauthorizedAppException(result.Message);
        return Ok(result);
    }

    // ── GET /api/admin/kyc/pending ───────────────────────────────────────────
    // Returns all KYC submissions with Status = "Pending".
    // Before returning, calls SyncKycFromAuthAsync to pull any new submissions
    // from AuthService that arrived via RabbitMQ but may have been missed.
    // Restricted to Admin role only.
    [Authorize(Roles = "Admin")]
    [HttpGet("kyc/pending")]
    public async Task<IActionResult> GetPendingKyc()
    {
        var result = await _admin.GetPendingKycAsync();
        return Ok(result);
    }

    // ── POST /api/admin/kyc/{id}/decide ─────────────────────────────────────
    // Approves or rejects a KYC submission.
    // Steps performed by the service layer:
    //   1. Validates the decision is "Approved" or "Rejected".
    //   2. Updates the KycReview record in AdminService's database.
    //   3. Calls AuthService to update the User's Status and KycDocument.
    //   4. Publishes a kyc_decisions event to RabbitMQ (picked up by
    //      WalletService to create the wallet and AuthService to sync status).
    //   5. Publishes a notification event so the user receives an email/in-app alert.
    // Restricted to Admin role only.
    [Authorize(Roles = "Admin")]
    [HttpPost("kyc/{id}/decide")]
    public async Task<IActionResult> DecideKyc(Guid id,
        [FromBody] KycDecisionRequest req)
    {
        var result = await _admin.DecideKycAsync(id, CurrentUserId, req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    // ── GET /api/admin/tickets ───────────────────────────────────────────────
    // Returns all support tickets from all users, ordered newest-first.
    // Used by the admin ticket management panel.
    // Restricted to Admin role only.
    [Authorize(Roles = "Admin")]
    [HttpGet("tickets")]
    public async Task<IActionResult> GetTickets()
    {
        var result = await _admin.GetTicketsAsync();
        return Ok(result);
    }

    // ── POST /api/admin/tickets/{id}/reply ───────────────────────────────────
    // Adds an admin reply to a support ticket and changes its status to "Responded".
    // Also publishes a notification event so the user receives an email/in-app alert
    // informing them that their ticket has been responded to.
    // Restricted to Admin role only.
    [Authorize(Roles = "Admin")]
    [HttpPost("tickets/{id}/reply")]
    public async Task<IActionResult> ReplyTicket(Guid id,
        [FromBody] TicketReplyRequest req)
    {
        var result = await _admin.ReplyTicketAsync(id, CurrentUserId, req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    // ── POST /api/admin/tickets/submit ───────────────────────────────────────
    // Allows any authenticated user to submit a support ticket.
    // The service layer calls AuthService to look up the user's email so it
    // can be stored with the ticket (for admin reference).
    // Accessible to all authenticated users (not just admins).
    [Authorize]
    [HttpPost("tickets/submit")]
    public async Task<IActionResult> SubmitTicket([FromBody] SubmitTicketRequest req)
    {
        var result = await _admin.SubmitTicketAsync(CurrentUserId, req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    // ── GET /api/admin/tickets/my ────────────────────────────────────────────
    // Returns only the tickets submitted by the currently authenticated user.
    // Used by the Support page to show the user their own ticket history
    // and any admin replies they have received.
    // Accessible to all authenticated users.
    [Authorize]
    [HttpGet("tickets/my")]
    public async Task<IActionResult> GetMyTickets()
    {
        var result = await _admin.GetMyTicketsAsync(CurrentUserId);
        return Ok(result);
    }
}
