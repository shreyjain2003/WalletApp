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
    private readonly IConfiguration _config;

    public AuthController(IAuthService auth, IConfiguration config)
    {
        _auth = auth;
        _config = config;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private bool IsInternalRequest()
    {
        var expectedKey = _config["InternalApiKey"] ?? "WalletAppInternalKey";
        return Request.Headers.TryGetValue("X-Internal-Api-Key", out var providedKey)
            && string.Equals(providedKey.ToString(), expectedKey, StringComparison.Ordinal);
    }

    private bool IsAdminOrInternalRequest() =>
        IsInternalRequest() || (User.Identity?.IsAuthenticated == true && User.IsInRole("Admin"));

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        var result = await _auth.RegisterAsync(req);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var result = await _auth.LoginAsync(req);
        if (!result.Success) return Unauthorized(result);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("kyc")]
    public async Task<IActionResult> SubmitKyc([FromBody] KycSubmitRequest req)
    {
        var result = await _auth.SubmitKycAsync(CurrentUserId, req);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("internal/user/{id}/kyc-decision")]
    public async Task<IActionResult> ApplyKycDecision(Guid id, [FromBody] KycDecisionRequest req)
    {
        if (!IsAdminOrInternalRequest())
            return Unauthorized(new ApiResponse<object>(false, "Unauthorized internal request.", null));

        var result = await _auth.ApplyKycDecisionAsync(id, req.Decision, req.AdminNote);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [Authorize]
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var result = await _auth.GetProfileAsync(CurrentUserId);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    [HttpGet("internal/user/{id}")]
    public async Task<IActionResult> GetUserById(Guid id)
    {
        if (!IsAdminOrInternalRequest())
            return Unauthorized(new ApiResponse<object>(false, "Unauthorized internal request.", null));

        var result = await _auth.GetProfileAsync(id);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpGet("internal/user-by-email")]
    public async Task<IActionResult> GetUserByEmail([FromQuery] string email)
    {
        var result = await _auth.GetUserByEmailAsync(email);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    [HttpGet("internal/users")]
    public async Task<IActionResult> GetAllUsers()
    {
        if (!IsAdminOrInternalRequest())
            return Unauthorized(new ApiResponse<object>(false, "Unauthorized internal request.", null));

        var result = await _auth.GetAllUsersAsync();
        return Ok(result);
    }

    [HttpPut("internal/user/{id}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest req)
    {
        if (!IsAdminOrInternalRequest())
            return Unauthorized(new ApiResponse<object>(false, "Unauthorized internal request.", null));

        var result = await _auth.UpdateUserAsync(id, req);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpDelete("internal/user/{id}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        if (!IsAdminOrInternalRequest())
            return Unauthorized(new ApiResponse<object>(false, "Unauthorized internal request.", null));

        var result = await _auth.DeleteUserAsync(id);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new ApiResponse<object>(false, "Invalid or expired token.", null));

        var result = await _auth.RefreshTokenAsync(userId);
        if (!result.Success) return Unauthorized(result);
        return Ok(result);
    }

    [Authorize]
    [HttpGet("pin/status")]
    public async Task<IActionResult> GetPinStatus()
    {
        var result = await _auth.GetPinStatusAsync(CurrentUserId);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("pin/set")]
    public async Task<IActionResult> SetPin([FromBody] SetPinRequest req)
    {
        var result = await _auth.SetPinAsync(CurrentUserId, req);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("pin/remove")]
    public async Task<IActionResult> RemovePin([FromBody] RemovePinRequest req)
    {
        var result = await _auth.RemovePinAsync(CurrentUserId, req);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("internal/user/{id}/pin/verify")]
    public async Task<IActionResult> VerifyUserPin(Guid id, [FromBody] VerifyPinRequest req)
    {
        if (!IsInternalRequest())
            return Unauthorized(new ApiResponse<object>(false, "Unauthorized internal request.", null));

        var result = await _auth.VerifyPinAsync(id, req.Pin);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }
}

public record KycDecisionRequest(string Decision, string? AdminNote);
