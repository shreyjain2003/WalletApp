using AuthService.DTOs;
using AuthService.Services;
using Microsoft.AspNetCore.Mvc;

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
        var success = await _auth.ResetPasswordAsync(request);

        if (!success)
            return BadRequest(new { success = false, message = "Invalid request" });

        return Ok(new
        {
            success = true,
            message = "Password reset successful"
        });
    }
}