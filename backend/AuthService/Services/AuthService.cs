using AuthService.DTOs;
using AuthService.Models;
using AuthService.Repositories;

namespace AuthService.Services;

public interface IAuthService
{
    Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest req);
    Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest req);
    Task<ApiResponse<object>> SubmitKycAsync(Guid userId, KycSubmitRequest req);
    Task<ApiResponse<object>> ApplyKycDecisionAsync(Guid userId, string decision, string? adminNote);
    Task<ApiResponse<UserProfileResponse>> UpdateUserAsync(Guid userId, UpdateUserRequest req);
    Task<ApiResponse<UserProfileResponse>> GetProfileAsync(Guid userId);
    Task<ApiResponse<UserProfileResponse>> GetUserByEmailAsync(string email);
    Task<ApiResponse<List<UserProfileResponse>>> GetAllUsersAsync();
    Task<ApiResponse<object>> DeleteUserAsync(Guid userId);
    Task<ApiResponse<AuthResponse>> RefreshTokenAsync(Guid userId);
    Task<ApiResponse<PinStatusResponse>> GetPinStatusAsync(Guid userId);
    Task<ApiResponse<object>> SetPinAsync(Guid userId, SetPinRequest req);
    Task<ApiResponse<object>> RemovePinAsync(Guid userId, RemovePinRequest req);
    Task<ApiResponse<object>> VerifyPinAsync(Guid userId, string pin);
}

public class AuthService : IAuthService
{
    private readonly IAuthRepository _repo;
    private readonly ITransactionPinRepository _pinRepo;
    private readonly ITokenService _tokenService;
    private readonly IRabbitMqPublisher _mq;

    public AuthService(IAuthRepository repo,
                       ITransactionPinRepository pinRepo,
                       ITokenService tokenService,
                       IRabbitMqPublisher mq)
    {
        _repo = repo;
        _pinRepo = pinRepo;
        _tokenService = tokenService;
        _mq = mq;
    }

    public async Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest req)
    {
        var normalizedEmail = req.Email.ToLower().Trim();
        var normalizedPhone = req.PhoneNumber.Trim();
        var normalizedName = req.FullName.Trim();

        if (await _repo.EmailExistsAsync(normalizedEmail))
            return new ApiResponse<AuthResponse>(false, "Email already registered.", null);

        if (await _repo.PhoneExistsAsync(normalizedPhone))
            return new ApiResponse<AuthResponse>(false, "Phone number already registered.", null);

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = normalizedName,
            Email = normalizedEmail,
            PhoneNumber = normalizedPhone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = "User",
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        await _repo.AddUserAsync(user);
        await _repo.SaveChangesAsync();

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

    public async Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest req)
    {
        var user = await _repo.GetUserByEmailAsync(req.Email.ToLower().Trim());

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return new ApiResponse<AuthResponse>(false, "Invalid email or password.", null);

        var token = _tokenService.GenerateToken(user);

        return new ApiResponse<AuthResponse>(
            true, "Login successful.",
            new AuthResponse(token, user.Id.ToString(), user.FullName,
                             user.Email, user.Role, user.Status));
    }

    public async Task<ApiResponse<object>> SubmitKycAsync(Guid userId, KycSubmitRequest req)
    {
        var user = await _repo.GetUserByIdAsync(userId, includeKyc: true);

        if (user == null)
            return new ApiResponse<object>(false, "User not found.", null);

        var existingKyc = user.KycDocument;

        if (existingKyc?.Status == "Approved")
            return new ApiResponse<object>(false, "KYC already approved.", null);

        if (existingKyc?.Status == "Pending")
            return new ApiResponse<object>(false, "KYC already submitted and under review.", null);

        if (existingKyc != null)
            _repo.RemoveKycDocument(existingKyc);

        var kyc = new KycDocument
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DocumentType = req.DocumentType,
            DocumentNumber = req.DocumentNumber,
            Status = "Pending",
            SubmittedAt = DateTime.UtcNow
        };

        await _repo.AddKycDocumentAsync(kyc);
        await _repo.SaveChangesAsync();

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

    public async Task<ApiResponse<object>> ApplyKycDecisionAsync(Guid userId, string decision, string? adminNote)
    {
        if (decision != "Approved" && decision != "Rejected")
            return new ApiResponse<object>(false, "Decision must be Approved or Rejected.", null);

        var user = await _repo.GetUserByIdAsync(userId, includeKyc: true);

        if (user == null)
            return new ApiResponse<object>(false, "User not found.", null);

        if (user.KycDocument == null)
            return new ApiResponse<object>(false, "KYC record not found.", null);

        user.Status = decision == "Approved" ? "Active" : "Rejected";
        user.KycDocument.Status = decision;
        user.KycDocument.AdminNote = adminNote;
        user.KycDocument.ReviewedAt = DateTime.UtcNow;

        await _repo.SaveChangesAsync();

        return new ApiResponse<object>(true, $"KYC {decision} applied.", null);
    }

    public async Task<ApiResponse<UserProfileResponse>> UpdateUserAsync(Guid userId, UpdateUserRequest req)
    {
        var user = await _repo.GetUserByIdAsync(userId, includeKyc: true);

        if (user == null)
            return new ApiResponse<UserProfileResponse>(false, "User not found.", null);

        var normalizedEmail = req.Email.ToLower().Trim();
        var normalizedPhone = req.PhoneNumber.Trim();
        var normalizedName = req.FullName.Trim();

        if (await _repo.EmailExistsAsync(normalizedEmail, userId))
            return new ApiResponse<UserProfileResponse>(false, "Email already registered.", null);

        if (await _repo.PhoneExistsAsync(normalizedPhone, userId))
            return new ApiResponse<UserProfileResponse>(false, "Phone number already registered.", null);

        user.FullName = normalizedName;
        user.Email = normalizedEmail;
        user.PhoneNumber = normalizedPhone;

        await _repo.SaveChangesAsync();

        return new ApiResponse<UserProfileResponse>(true, "User updated successfully.", MapProfile(user));
    }

    public async Task<ApiResponse<UserProfileResponse>> GetProfileAsync(Guid userId)
    {
        var user = await _repo.GetUserByIdAsync(userId, includeKyc: true);

        if (user == null)
            return new ApiResponse<UserProfileResponse>(false, "User not found.", null);

        return new ApiResponse<UserProfileResponse>(true, "OK", MapProfile(user));
    }

    public async Task<ApiResponse<UserProfileResponse>> GetUserByEmailAsync(string email)
    {
        var user = await _repo.GetUserByEmailAsync(email.ToLower().Trim(), includeKyc: true);

        if (user == null)
            return new ApiResponse<UserProfileResponse>(false, "User not found.", null);

        return new ApiResponse<UserProfileResponse>(true, "OK", MapProfile(user));
    }

    public async Task<ApiResponse<List<UserProfileResponse>>> GetAllUsersAsync()
    {
        var users = await _repo.GetUsersByRoleAsync("User", includeKyc: true);
        return new ApiResponse<List<UserProfileResponse>>(
            true,
            "OK",
            users.Select(MapProfile).ToList());
    }

    public async Task<ApiResponse<object>> DeleteUserAsync(Guid userId)
    {
        var user = await _repo.GetUserByIdAsync(userId, includeKyc: true);

        if (user == null)
            return new ApiResponse<object>(false, "User not found.", null);

        if (user.KycDocument != null)
            _repo.RemoveKycDocument(user.KycDocument);

        _repo.RemoveUser(user);
        await _repo.SaveChangesAsync();

        return new ApiResponse<object>(true, "User deleted successfully.", null);
    }

    public async Task<ApiResponse<AuthResponse>> RefreshTokenAsync(Guid userId)
    {
        var user = await _repo.GetUserByIdAsync(userId);

        if (user == null)
            return new ApiResponse<AuthResponse>(false, "User not found.", null);

        var token = _tokenService.GenerateToken(user);

        return new ApiResponse<AuthResponse>(
            true, "Token refreshed.",
            new AuthResponse(token, user.Id.ToString(), user.FullName,
                             user.Email, user.Role, user.Status));
    }

    public async Task<ApiResponse<PinStatusResponse>> GetPinStatusAsync(Guid userId)
    {
        var hasPin = await _pinRepo.HasPinAsync(userId);
        return new ApiResponse<PinStatusResponse>(true, "OK", new PinStatusResponse(hasPin));
    }

    public async Task<ApiResponse<object>> SetPinAsync(Guid userId, SetPinRequest req)
    {
        if (!IsValidPin(req.NewPin) || !IsValidPin(req.ConfirmPin))
            return new ApiResponse<object>(false, "PIN must be exactly 4 digits.", null);

        if (req.NewPin != req.ConfirmPin)
            return new ApiResponse<object>(false, "PIN confirmation does not match.", null);

        var hasExistingPin = await _pinRepo.HasPinAsync(userId);
        if (hasExistingPin)
        {
            if (!IsValidPin(req.CurrentPin))
                return new ApiResponse<object>(false, "Current PIN is required.", null);

            var isCurrentPinValid = await _pinRepo.VerifyPinAsync(userId, req.CurrentPin!);
            if (!isCurrentPinValid)
                return new ApiResponse<object>(false, "Current PIN is incorrect.", null);
        }

        await _pinRepo.SetPinAsync(userId, req.NewPin);
        return new ApiResponse<object>(true,
            hasExistingPin ? "Transaction PIN updated successfully." : "Transaction PIN set successfully.",
            null);
    }

    public async Task<ApiResponse<object>> RemovePinAsync(Guid userId, RemovePinRequest req)
    {
        var hasPin = await _pinRepo.HasPinAsync(userId);
        if (!hasPin)
            return new ApiResponse<object>(false, "No transaction PIN is set.", null);

        if (!IsValidPin(req.CurrentPin))
            return new ApiResponse<object>(false, "Current PIN is required.", null);

        var isCurrentPinValid = await _pinRepo.VerifyPinAsync(userId, req.CurrentPin);
        if (!isCurrentPinValid)
            return new ApiResponse<object>(false, "Current PIN is incorrect.", null);

        await _pinRepo.RemovePinAsync(userId);
        return new ApiResponse<object>(true, "Transaction PIN removed successfully.", null);
    }

    public async Task<ApiResponse<object>> VerifyPinAsync(Guid userId, string pin)
    {
        var hasPin = await _pinRepo.HasPinAsync(userId);
        if (!hasPin)
            return new ApiResponse<object>(false, "Transaction PIN is not set.", null);

        if (!IsValidPin(pin))
            return new ApiResponse<object>(false, "Transaction PIN is required.", null);

        var isValid = await _pinRepo.VerifyPinAsync(userId, pin);
        if (!isValid)
            return new ApiResponse<object>(false, "Invalid transaction PIN.", null);

        return new ApiResponse<object>(true, "PIN verified.", null);
    }

    private static UserProfileResponse MapProfile(User user)
    {
        var kyc = user.KycDocument;
        KycResponse? kycResp = kyc == null ? null : new KycResponse(
            kyc.Id, kyc.DocumentType, kyc.DocumentNumber,
            kyc.Status, kyc.AdminNote, kyc.SubmittedAt, kyc.ReviewedAt);

        return new UserProfileResponse(
            user.Id, user.FullName, user.Email,
            user.PhoneNumber, user.Status, user.Role, kycResp);
    }

    private static bool IsValidPin(string? pin) =>
        !string.IsNullOrWhiteSpace(pin)
        && pin.Length == 4
        && pin.All(char.IsDigit);
}
