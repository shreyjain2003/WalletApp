using AuthService.Data;
using AuthService.DTOs;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IAuthService
{
    Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest req);
    Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest req);
    Task<ApiResponse<object>> SubmitKycAsync(Guid userId, KycSubmitRequest req);
    Task<ApiResponse<UserProfileResponse>> GetProfileAsync(Guid userId);
    Task<ApiResponse<UserProfileResponse>> GetUserByEmailAsync(string email);
    Task<ApiResponse<List<UserProfileResponse>>> GetAllUsersAsync();
    Task<ApiResponse<object>> DeleteUserAsync(Guid userId);
}

public class AuthService : IAuthService
{
    private readonly AuthDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly IRabbitMqPublisher _mq;

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
        var emailTaken = await _db.Users
            .AnyAsync(u => u.Email == req.Email.ToLower().Trim());

        if (emailTaken)
            return new ApiResponse<AuthResponse>(false, "Email already registered.", null);

        var phoneTaken = await _db.Users
            .AnyAsync(u => u.PhoneNumber == req.PhoneNumber.Trim());

        if (phoneTaken)
            return new ApiResponse<AuthResponse>(false, "Phone number already registered.", null);

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
        await _db.SaveChangesAsync();

        var token = _tokenService.GenerateToken(user);

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
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == req.Email.ToLower().Trim());

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return new ApiResponse<AuthResponse>(false, "Invalid email or password.", null);

        var token = _tokenService.GenerateToken(user);

        return new ApiResponse<AuthResponse>(
            true, "Login successful.",
            new AuthResponse(token, user.Id.ToString(), user.FullName,
                             user.Email, user.Role, user.Status));
    }

    // ── SUBMIT KYC ────────────────────────────────────────────────────────
    public async Task<ApiResponse<object>> SubmitKycAsync(Guid userId, KycSubmitRequest req)
    {
        var user = await _db.Users
            .Include(u => u.KycDocument)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return new ApiResponse<object>(false, "User not found.", null);

        var existingKyc = user.KycDocument;

        if (existingKyc?.Status == "Approved")
            return new ApiResponse<object>(false, "KYC already approved.", null);

        if (existingKyc?.Status == "Pending")
            return new ApiResponse<object>(false, "KYC already submitted and under review.", null);

        if (existingKyc != null)
            _db.KycDocuments.Remove(existingKyc);

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

    // ── GET ALL USERS ─────────────────────────────────────────────────────
    public async Task<ApiResponse<List<UserProfileResponse>>> GetAllUsersAsync()
    {
        var users = await _db.Users
            .Include(u => u.KycDocument)
            .Where(u => u.Role == "User")
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync();

        var result = users.Select(u => {
            var kyc = u.KycDocument;
            KycResponse? kycResp = kyc == null ? null : new KycResponse(
                kyc.Id, kyc.DocumentType, kyc.DocumentNumber,
                kyc.Status, kyc.AdminNote, kyc.SubmittedAt, kyc.ReviewedAt);

            return new UserProfileResponse(
                u.Id, u.FullName, u.Email,
                u.PhoneNumber, u.Status, u.Role, kycResp);
        }).ToList();

        return new ApiResponse<List<UserProfileResponse>>(true, "OK", result);
    }
    // ── DELETE USER ───────────────────────────────────────────────────────
    public async Task<ApiResponse<object>> DeleteUserAsync(Guid userId)
    {
        var user = await _db.Users
            .Include(u => u.KycDocument)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return new ApiResponse<object>(false, "User not found.", null);

        if (user.KycDocument != null)
            _db.KycDocuments.Remove(user.KycDocument);

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        return new ApiResponse<object>(true, "User deleted successfully.", null);
    }
}