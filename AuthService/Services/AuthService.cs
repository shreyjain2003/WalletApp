using AuthService.Data;
using AuthService.DTOs;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections;

namespace AuthService.Services;

public interface IAuthService
{
    Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest req);
    Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest req);
    Task<ApiResponse<object>> SubmitKycAsync(Guid userId, KycSubmitRequest req);
    Task<ApiResponse<UserProfileResponse>> GetProfileAsync(Guid userId);
    Task<ApiResponse<UserProfileResponse>> GetUserByEmailAsync(string email);
}

public class AuthService : IAuthService
{
    private readonly AuthDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly IRabbitMqPublisher _mq;

    // ── GET BY EMAIL ──────────────────────────────────────────────────────
    public async Task<ApiResponse<UserProfileResponse>> GetUserByEmailAsync(string email)
    {
        var user = await _db.Users
            .Include(u => u.KycDocument)
            .FirstOrDefaultAsync(u => u.Email == email.ToLower().Trim());

        if (user == null)
            return new ApiResponse<UserProfileResponse>(false, "User not found.", null);

        var kyc = user.KycDocument;

        KycResponse? kycResp = kyc == null ? null : new KycResponse(
            kyc.Id, kyc.DocumentType, kyc.DocumentNumber,
            kyc.Status, kyc.AdminNote, kyc.SubmittedAt, kyc.ReviewedAt);

        var profile = new UserProfileResponse(
            user.Id, user.FullName, user.Email,
            user.PhoneNumber, user.Status, user.Role, kycResp);

        return new ApiResponse<UserProfileResponse>(true, "OK", profile);
    }
    // ASP.NET automatically injects these — this is Dependency Injection
    public AuthService(AuthDbContext db,
                       ITokenService tokenService,
                       IRabbitMqPublisher mq)
    {
        _db = db;
        _tokenService = tokenService;
        _mq = mq;
    }

    // ── REGISTER ──────────────────────────────────────────────────────────
    public async Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest req)
    {
        // 1. Check email not already taken
        var emailTaken = await _db.Users
            .AnyAsync(u => u.Email == req.Email.ToLower().Trim());

        if (emailTaken)
            return new ApiResponse<AuthResponse>(false, "Email already registered.", null);

        // 2. Check phone not already taken
        var phoneTaken = await _db.Users
            .AnyAsync(u => u.PhoneNumber == req.PhoneNumber.Trim());

        if (phoneTaken)
            return new ApiResponse<AuthResponse>(false, "Phone number already registered.", null);

        // 3. Create the user
        // BCrypt turns "mypassword" into a safe hash like "$2a$11$N9qo8..."
        // NEVER store plain text passwords
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = req.FullName.Trim(),
            Email = req.Email.ToLower().Trim(),
            PhoneNumber = req.PhoneNumber.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = "User",
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(); // writes to SQL Server

        // 4. Generate JWT token
        var token = _tokenService.GenerateToken(user);

        // 5. Notify user via RabbitMQ
        _mq.Publish("notifications", new
        {
            UserId = user.Id.ToString(),
            Title = "Welcome to WalletApp!",
            Message = $"Hi {user.FullName}, your account was created. Please submit KYC to activate your wallet.",
            Type = "welcome"
        });

        return new ApiResponse<AuthResponse>(
            true, "Registration successful.",
            new AuthResponse(token, user.Id.ToString(), user.FullName,
                             user.Email, user.Role, user.Status));
    }

    // ── LOGIN ─────────────────────────────────────────────────────────────
    public async Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest req)
    {
        // 1. Find user by email
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == req.Email.ToLower().Trim());

        // 2. Verify password
        // We give the SAME error for wrong email OR wrong password
        // This is intentional — never tell attackers which one is wrong
        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return new ApiResponse<AuthResponse>(false, "Invalid email or password.", null);

        // 3. Generate and return token
        var token = _tokenService.GenerateToken(user);

        return new ApiResponse<AuthResponse>(
            true, "Login successful.",
            new AuthResponse(token, user.Id.ToString(), user.FullName,
                             user.Email, user.Role, user.Status));
    }

    // ── SUBMIT KYC ────────────────────────────────────────────────────────
    public async Task<ApiResponse<object>> SubmitKycAsync(Guid userId, KycSubmitRequest req)
    {
        // 1. Load user with their KYC documents
        var user = await _db.Users
            .Include(u => u.KycDocument)  // JOIN with KycDocuments table
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return new ApiResponse<object>(false, "User not found.", null);

        // 2. Check existing KYC status
        var existingKyc = user.KycDocument;

        if (existingKyc?.Status == "Approved")
            return new ApiResponse<object>(false, "KYC already approved.", null);

        if (existingKyc?.Status == "Pending")
            return new ApiResponse<object>(false, "KYC already submitted and under review.", null);

        // 3. If rejected — remove old record and allow resubmit
        if (existingKyc != null)
            _db.KycDocuments.Remove(existingKyc);

        // 4. Create new KYC record
        var kyc = new KycDocument
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DocumentType = req.DocumentType,
            DocumentNumber = req.DocumentNumber,
            Status = "Pending",
            SubmittedAt = DateTime.UtcNow
        };

        _db.KycDocuments.Add(kyc);
        await _db.SaveChangesAsync();

        // 5. Publish to RabbitMQ — AdminService listens and syncs this
        _mq.Publish("kyc_submissions", new
        {
            UserId = userId.ToString(),
            FullName = user.FullName,
            Email = user.Email,
            DocumentType = req.DocumentType,
            DocumentNumber = req.DocumentNumber,
            SubmittedAt = kyc.SubmittedAt
        });

        return new ApiResponse<object>(true, "KYC submitted. Awaiting admin review.", null);
    }

    // ── GET PROFILE ───────────────────────────────────────────────────────
    public async Task<ApiResponse<UserProfileResponse>> GetProfileAsync(Guid userId)
    {
        var user = await _db.Users
            .Include(u => u.KycDocument)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return new ApiResponse<UserProfileResponse>(false, "User not found.", null);

        var kyc = user.KycDocument;

        KycResponse? kycResp = kyc == null ? null : new KycResponse(
            kyc.Id, kyc.DocumentType, kyc.DocumentNumber,
            kyc.Status, kyc.AdminNote, kyc.SubmittedAt, kyc.ReviewedAt);

        var profile = new UserProfileResponse(
            user.Id, user.FullName, user.Email,
            user.PhoneNumber, user.Status, user.Role, kycResp);

        return new ApiResponse<UserProfileResponse>(true, "OK", profile);
    }
}