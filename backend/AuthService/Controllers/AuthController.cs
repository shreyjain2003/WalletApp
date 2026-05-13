// ============================================================
// AuthController.cs — AuthService
// ------------------------------------------------------------
// Handles the core authentication HTTP endpoints:
//   POST /api/auth/register      — create a new user account
//   POST /api/auth/login         — validate credentials, return JWT
//   POST /api/auth/refresh       — re-issue a fresh JWT (requires valid token)
//   POST /api/auth/forgot-password  — trigger OTP email for password reset
//   POST /api/auth/verify-reset-otp — validate OTP, return a one-time reset token
//   POST /api/auth/reset-password   — set a new password using the reset token
//
// All routes are public (no [Authorize]) except /refresh which requires
// a valid Bearer token so we know which user to re-issue for.
// ============================================================

using AuthService.DTOs;
using AuthService.Repositories;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AuthService.Controllers;

// [ApiController] enables automatic model validation and problem-detail responses.
// [Route("api/auth")] sets the base URL prefix for every action in this controller.
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    // IAuthService handles business logic: hashing, duplicate checks, OTP sessions.
    private readonly IAuthService _auth;

    // ITokenService generates signed JWT strings from a User entity.
    private readonly ITokenService _tokenService;

    // IAuthRepository gives direct DB access needed for the /refresh endpoint
    // (we need to reload the latest user record before re-signing the token).
    private readonly IAuthRepository _repo;

    // Dependencies are injected by the DI container configured in Program.cs.
    public AuthController(IAuthService auth, ITokenService tokenService, IAuthRepository repo)
    {
        _auth = auth;
        _tokenService = tokenService;
        _repo = repo;
    }

    // ── POST /api/auth/register ──────────────────────────────────────────────
    // Creates a new user account.
    // Validates uniqueness of email and phone, hashes the password with BCrypt,
    // saves the user, publishes a welcome notification, and returns a JWT so the
    // user is immediately logged in after registration.
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        var result = await _auth.RegisterAsync(req);
        // 200 OK on success, 400 Bad Request if email/phone already exists.
        return result.Success ? Ok(result) : BadRequest(result);
    }

    // ── POST /api/auth/login ─────────────────────────────────────────────────
    // Validates email + password and returns a signed JWT on success.
    // BCrypt.Verify is used to compare the submitted password against the stored hash.
    // Returns 401 Unauthorized if credentials are wrong (intentionally vague message
    // to prevent user enumeration attacks).
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var result = await _auth.LoginAsync(req);
        return result.Success ? Ok(result) : Unauthorized(result);
    }

    // ── POST /api/auth/refresh ───────────────────────────────────────────────
    // Re-issues a fresh 8-hour JWT for the currently authenticated user.
    // Called by the frontend TokenRefreshService every 15 minutes to keep the
    // session alive without forcing the user to log in again.
    // Requires a valid (non-expired) Bearer token — the user ID is read from
    // the ClaimTypes.NameIdentifier claim embedded in the existing token.
    [Authorize]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        // Extract the user ID from the JWT claims (put there at login time).
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized(new { success = false, message = "Invalid token." });

        // Reload the user from the database to pick up any status/role changes
        // that happened since the original token was issued.
        var user = await _repo.GetUserByIdAsync(userId);
        if (user == null)
            return Unauthorized(new { success = false, message = "User not found." });

        // Generate a brand-new signed token with the latest user data.
        var newToken = _tokenService.GenerateToken(user);

        return Ok(new ApiResponse<AuthResponse>(true, "Token refreshed.",
            new AuthResponse(newToken, user.Id.ToString(), user.FullName, user.Email, user.Role, user.Status)));
    }

    // ── POST /api/auth/forgot-password ──────────────────────────────────────
    // Initiates the password reset flow.
    // Generates a 6-digit OTP, stores its SHA-256 hash in PasswordResetSessions,
    // and publishes a notification event so NotificationService sends the OTP email.
    // Always returns 200 OK regardless of whether the email exists — this prevents
    // attackers from discovering which emails are registered (user enumeration).
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        // The service silently does nothing if the email is not found.
        await _auth.RequestPasswordResetAsync(request.Email);

        // Deliberately vague response to prevent user enumeration.
        return Ok(new
        {
            success = true,
            message = "If account exists, OTP sent."
        });
    }

    // ── POST /api/auth/verify-reset-otp ─────────────────────────────────────
    // Validates the 6-digit OTP the user received by email.
    // On success, returns a one-time reset token (a UUID) that must be passed to
    // /reset-password within 10 minutes. The reset token is also stored as a
    // SHA-256 hash so it cannot be replayed if the database is compromised.
    // Increments the attempt counter on failure; locks the session after 5 failures.
    [HttpPost("verify-reset-otp")]
    public async Task<IActionResult> VerifyOtp(VerifyPasswordResetOtpRequest request)
    {
        var result = await _auth.VerifyOtpAsync(request.Email, request.Otp);

        // null means OTP was wrong, expired, or max attempts reached.
        if (result == null)
            return BadRequest(new { success = false, message = "Invalid or expired OTP" });

        // Return the plain-text reset token to the frontend.
        // Only the hash is stored in the database.
        return Ok(new
        {
            success = true,
            resetToken = result.ResetToken,
            expiresAtUtc = result.ExpiresAtUtc
        });
    }

    // ── POST /api/auth/reset-password ───────────────────────────────────────
    // Sets a new password using the reset token obtained from /verify-reset-otp.
    // Validates that NewPassword == ConfirmPassword, verifies the reset token hash,
    // checks the token has not expired or been used before, then BCrypt-hashes and
    // saves the new password. Marks the session as used to prevent replay attacks.
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        // Client-side check duplicated here as a safety net.
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
