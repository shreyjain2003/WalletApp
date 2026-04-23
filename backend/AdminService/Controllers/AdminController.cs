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
    private readonly IAdminService _admin;

    public AdminController(IAdminService admin)
    {
        _admin = admin;
    }

    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] AdminLoginRequest req)
    {
        var result = await _admin.LoginAsync(req);
        if (!result.Success) throw new UnauthorizedAppException(result.Message);
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("kyc/pending")]
    public async Task<IActionResult> GetPendingKyc()
    {
        var result = await _admin.GetPendingKycAsync();
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("kyc/{id}/decide")]
    public async Task<IActionResult> DecideKyc(Guid id,
        [FromBody] KycDecisionRequest req)
    {
        var result = await _admin.DecideKycAsync(id, CurrentUserId, req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("tickets")]
    public async Task<IActionResult> GetTickets()
    {
        var result = await _admin.GetTicketsAsync();
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("tickets/{id}/reply")]
    public async Task<IActionResult> ReplyTicket(Guid id,
        [FromBody] TicketReplyRequest req)
    {
        var result = await _admin.ReplyTicketAsync(id, CurrentUserId, req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("tickets/submit")]
    public async Task<IActionResult> SubmitTicket([FromBody] SubmitTicketRequest req)
    {
        var result = await _admin.SubmitTicketAsync(CurrentUserId, req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    [Authorize]
    [HttpGet("tickets/my")]
    public async Task<IActionResult> GetMyTickets()
    {
        var result = await _admin.GetMyTicketsAsync(CurrentUserId);
        return Ok(result);
    }
}
