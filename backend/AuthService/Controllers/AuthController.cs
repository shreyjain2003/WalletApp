using AuthService.DTOs;
using AuthService.Repositories;
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
    private readonly ITokenService _tokenService;
    private readonly IAuthRepository _repo;

    public AuthController(IAuthService auth, ITokenService tokenService, IAuthRepository repo)
    {
        _auth = auth;
        _tokenService = tokenService;
        _repo = repo;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        var result = await _auth.RegisterAsync(req);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var result = await _auth.LoginAsync(req);
        return result.Success ? Ok(result) : Unauthorized(result);
    }

    // 🔄 TOKEN REFRESH — re-issues a fresh JWT for the current user
    [Authorize]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized(new { success = false, message = "Invalid token." });

        var user = await _repo.GetUserByIdAsync(userId);
        if (user == null)
            return Unauthorized(new { success = false, message = "User not found." });

        var newToken = _tokenService.GenerateToken(user);

        return Ok(new ApiResponse<AuthResponse>(true, "Token refreshed.",
            new AuthResponse(newToken, user.Id.ToString(), user.FullName, user.Email, user.Role, user.Status)));
    }

    // 🔥 FORGOT PASSWORD

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        await _auth.RequestPasswordResetAsync(request.Email);

        return Ok(new
        {
            success = true,
            message = "If account exists, OTP sent."
        });
    }

    [HttpPost("verify-reset-otp")]
    public async Task<IActionResult> VerifyOtp(VerifyPasswordResetOtpRequest request)
    {
        var result = await _auth.VerifyOtpAsync(request.Email, request.Otp);

        if (result == null)
            return BadRequest(new { success = false, message = "Invalid or expired OTP" });

        return Ok(new
        {
            success = true,
            resetToken = result.ResetToken,
            expiresAtUtc = result.ExpiresAtUtc
        });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        if (request.NewPassword != request.ConfirmPassword)
            return BadRequest(new { success = false, message = "Passwords do not match." });

        var success = await _auth.ResetPasswordAsync(request);

        if (!success)
            return BadRequest(new { success = false, message = "Reset link is invalid or has expired. Please request a new OTP." });

        return Ok(new
        {
            success = true,
            message = "Password reset successful"
        });
    }
}