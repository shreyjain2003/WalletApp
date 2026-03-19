using AuthService.DTOs;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AuthService.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth)
    {
        _auth = auth;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── POST /api/auth/register ───────────────────────────────────────────
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        var result = await _auth.RegisterAsync(req);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var result = await _auth.LoginAsync(req);

        if (!result.Success)
            return Unauthorized(result);

        return Ok(result);
    }

    // ── POST /api/auth/kyc ────────────────────────────────────────────────
    [Authorize]
    [HttpPost("kyc")]
    public async Task<IActionResult> SubmitKyc([FromBody] KycSubmitRequest req)
    {
        var result = await _auth.SubmitKycAsync(CurrentUserId, req);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // ── GET /api/auth/profile ─────────────────────────────────────────────
    [Authorize]
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var result = await _auth.GetProfileAsync(CurrentUserId);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    // ── GET /api/auth/internal/user/{id} ─────────────────────────────────
    [HttpGet("internal/user/{id}")]
    public async Task<IActionResult> GetUserById(Guid id)
    {
        var result = await _auth.GetProfileAsync(id);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    // ── GET /api/auth/internal/user-by-email ─────────────────────────────
    // Called by AdminService to look up user by email
    [AllowAnonymous]
    [HttpGet("internal/user-by-email")]
    public async Task<IActionResult> GetUserByEmail([FromQuery] string email)
    {
        var result = await _auth.GetUserByEmailAsync(email);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    // ── GET /api/auth/internal/users ─────────────────────────────────────
    // Internal endpoint — called by AdminService only
    [HttpGet("internal/users")]
    public async Task<IActionResult> GetAllUsers()
    {
        var users = await _db.Users
            .Include(u => u.KycDocument)
            .Where(u => u.Role == "User")
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new UserProfileResponse(
                u.Id, u.FullName, u.Email,
                u.PhoneNumber, u.Status, u.Role,
                u.KycDocument == null ? null : new KycResponse(
                    u.KycDocument.Id,
                    u.KycDocument.DocumentType,
                    u.KycDocument.DocumentNumber,
                    u.KycDocument.Status,
                    u.KycDocument.AdminNote,
                    u.KycDocument.SubmittedAt,
                    u.KycDocument.ReviewedAt
                )))
            .ToListAsync();

        return Ok(new ApiResponse<List<UserProfileResponse>>(true, "OK", users));
    }
}