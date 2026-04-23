using AuthService.DTOs;
using AuthService.Models;
using AuthService.Repositories;
using System.Security.Cryptography;

namespace AuthService.Services;

public interface IAuthService
{
    Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest req);
    Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest req);

    Task RequestPasswordResetAsync(string email);
    Task<VerifyPasswordResetOtpResponse?> VerifyOtpAsync(string email, string otp);
    Task<bool> ResetPasswordAsync(ResetPasswordRequest request);
}

public class AuthService : IAuthService
{
    private readonly IAuthRepository _repo;
    private readonly ITokenService _tokenService;
    private readonly IRabbitMqPublisher _mq;

    public AuthService(IAuthRepository repo,
                       ITokenService tokenService,
                       IRabbitMqPublisher mq)
    {
        _repo = repo;
        _tokenService = tokenService;
        _mq = mq;
    }

    public async Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest req)
    {
        var email = req.Email.ToLower().Trim();
        var fullName = req.FullName.Trim();
        var phone = req.PhoneNumber.Trim();

        if (await _repo.EmailExistsAsync(email))
            return new ApiResponse<AuthResponse>(false, "Email already exists", null);

        if (await _repo.PhoneExistsAsync(phone))
            return new ApiResponse<AuthResponse>(false, "Phone number already registered", null);

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Email = email,
            PhoneNumber = phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = "User",
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        await _repo.AddUserAsync(user);
        await _repo.SaveChangesAsync();

        await _mq.PublishAsync("notifications", new { 
            userId = user.Id.ToString(), 
            fullName = user.FullName, 
            email = user.Email, 
            type = "welcome" 
        });

        var token = _tokenService.GenerateToken(user);

        return new ApiResponse<AuthResponse>(true, "Success",
            new AuthResponse(token, user.Id.ToString(), user.FullName, user.Email, user.Role, user.Status));
    }

    public async Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest req)
    {
        var user = await _repo.GetUserByEmailAsync(req.Email.ToLower());

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return new ApiResponse<AuthResponse>(false, "Invalid credentials", null);

        var token = _tokenService.GenerateToken(user);

        return new ApiResponse<AuthResponse>(true, "Success",
            new AuthResponse(token, user.Id.ToString(), user.FullName, user.Email, user.Role, user.Status));
    }

    // 🔥 FORGOT PASSWORD FLOW

    public async Task RequestPasswordResetAsync(string email)
    {
        var user = await _repo.GetUserByEmailAsync(email.ToLower().Trim());
        if (user == null) return;

        var otp = GenerateOtp();
        var session = new PasswordResetSession
        {
            UserId = user.Id,
            Purpose = "PASSWORD_RESET",
            OtpHash = Hash(otp),
            OtpExpiresAtUtc = DateTime.UtcNow.AddMinutes(10),
            MaxAttempts = 5,
            Attempts = 0
        };

        await _repo.AddPasswordResetSessionAsync(session);
        await _repo.SaveChangesAsync();

        await _mq.PublishAsync("notifications", new
        {
            userId = user.Id.ToString(),
            email = user.Email,
            otp = otp           
        });
    }

    public async Task<VerifyPasswordResetOtpResponse?> VerifyOtpAsync(string email, string otp)
    {
        var user = await _repo.GetUserByEmailAsync(email.ToLower().Trim());
        if (user == null) return null;

        var session = await _repo.GetLatestPasswordResetSessionAsync(user.Id, "PASSWORD_RESET");

        if (session == null || session.OtpExpiresAtUtc < DateTime.UtcNow)
            return null;

        if (session.Attempts >= session.MaxAttempts)
            return null;

        // Verify OTP first, then increment attempts only on failure
        if (!VerifyHash(otp, session.OtpHash))
        {
            session.Attempts++;
            session.LastAttemptAtUtc = DateTime.UtcNow;
            await _repo.SaveChangesAsync();
            return null;
        }

        var resetToken = Guid.NewGuid().ToString();

        session.ResetTokenHash = Hash(resetToken);
        session.ResetTokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(10);
        session.VerifiedAtUtc = DateTime.UtcNow;

        await _repo.SaveChangesAsync();

        return new VerifyPasswordResetOtpResponse(resetToken, session.ResetTokenExpiresAtUtc.Value);
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request)
    {
        if (request.NewPassword != request.ConfirmPassword)
            return false;

        var user = await _repo.GetUserByEmailAsync(request.Email.ToLower().Trim());
        if (user == null) return false;

        var session = await _repo.GetLatestVerifiedPasswordResetSessionAsync(user.Id, "PASSWORD_RESET");

        if (session == null || session.ResetTokenExpiresAtUtc < DateTime.UtcNow)
            return false;

        if (session.ResetTokenHash == null ||
            !VerifyHash(request.ResetToken, session.ResetTokenHash))
            return false;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        session.UsedAtUtc = DateTime.UtcNow;

        await _repo.SaveChangesAsync();

        return true;
    }

    // 🔧 HELPERS

    private static string GenerateOtp()
    {
        // Use cryptographically secure random number generator
        var bytes = new byte[4];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        var value = Math.Abs(BitConverter.ToInt32(bytes, 0)) % 900000 + 100000;
        return value.ToString();
    }

    private string Hash(string input)
    {
        using var sha = SHA256.Create();
        return Convert.ToBase64String(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(input)));
    }

    private bool VerifyHash(string input, string hash) =>
        Hash(input) == hash;
}
