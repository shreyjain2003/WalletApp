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
    private readonly IAdminService _admin;

    public AdminController(IAdminService admin)
    {
        _admin = admin;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── POST /api/admin/login ─────────────────────────────────────────────
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] AdminLoginRequest req)
    {
        var result = await _admin.LoginAsync(req);

        if (!result.Success)
            return Unauthorized(result);

        return Ok(result);
    }

    // ── GET /api/admin/kyc/pending ────────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpGet("kyc/pending")]
    public async Task<IActionResult> GetPendingKyc()
    {
        var result = await _admin.GetPendingKycAsync();
        return Ok(result);
    }

    // ── POST /api/admin/kyc/{id}/decide ───────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPost("kyc/{id}/decide")]
    public async Task<IActionResult> DecideKyc(Guid id,
        [FromBody] KycDecisionRequest req)
    {
        var result = await _admin.DecideKycAsync(id, CurrentUserId, req);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // ── GET /api/admin/tickets ────────────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpGet("tickets")]
    public async Task<IActionResult> GetTickets()
    {
        var result = await _admin.GetTicketsAsync();
        return Ok(result);
    }

    // ── POST /api/admin/tickets/{id}/reply ────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPost("tickets/{id}/reply")]
    public async Task<IActionResult> ReplyTicket(Guid id,
        [FromBody] TicketReplyRequest req)
    {
        var result = await _admin.ReplyTicketAsync(id, CurrentUserId, req);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // ── POST /api/admin/tickets/submit ────────────────────────────────────
    [Authorize]
    [HttpPost("tickets/submit")]
    public async Task<IActionResult> SubmitTicket([FromBody] SubmitTicketRequest req)
    {
        var result = await _admin.SubmitTicketAsync(CurrentUserId, req);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // ── GET /api/admin/tickets/my ─────────────────────────────────────────
    [Authorize]
    [HttpGet("tickets/my")]
    public async Task<IActionResult> GetMyTickets()
    {
        var result = await _admin.GetMyTicketsAsync(CurrentUserId);
        return Ok(result);
    }
}