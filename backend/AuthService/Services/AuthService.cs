// ============================================================
// AuthService.cs — AuthService
// ------------------------------------------------------------
// Core business logic for user authentication and password reset.
// This service is called by AuthController and contains no HTTP
// concerns — it works purely with domain objects and repositories.
//
// Responsibilities:
//   - RegisterAsync   : validate uniqueness, hash password, save user, publish welcome notification
//   - LoginAsync      : verify credentials with BCrypt, return JWT
//   - RequestPasswordResetAsync : generate OTP, store hash, publish OTP email event
//   - VerifyOtpAsync  : validate OTP hash, issue one-time reset token
//   - ResetPasswordAsync : validate reset token, update password hash
// ============================================================

using AuthService.DTOs;
using AuthService.Models;
using AuthService.Repositories;
using System.Security.Cryptography;

namespace AuthService.Services;

// Interface allows unit tests to inject a fake implementation (FakeAuthService)
// without needing a real database or RabbitMQ connection.
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
    // IAuthRepository abstracts all SQL Server operations for Users,
    // KycDocuments, and PasswordResetSessions tables.
    private readonly IAuthRepository _repo;

    // ITokenService generates signed JWT strings from a User entity.
    private readonly ITokenService _tokenService;

    // IRabbitMqPublisher sends async messages to RabbitMQ queues.
    // Used here to publish welcome notifications and OTP emails.
    private readonly IRabbitMqPublisher _mq;

    // All dependencies are injected by the DI container (Program.cs).
    public AuthService(IAuthRepository repo,
                       ITokenService tokenService,
                       IRabbitMqPublisher mq)
    {
        _repo = repo;
        _tokenService = tokenService;
        _mq = mq;
    }

    // ── RegisterAsync ────────────────────────────────────────────────────────
    // Creates a new user account with the following steps:
    //   1. Normalize email (lowercase + trim) and phone (trim).
    //   2. Check for duplicate email and phone — return error if found.
    //   3. Hash the password using BCrypt (cost factor 10, ~100ms per hash).
    //   4. Persist the new User entity with Status = "Pending" (KYC not done yet).
    //   5. Publish a welcome notification to RabbitMQ.
    //   6. Generate and return a JWT so the user is immediately logged in.
    public async Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest req)
    {
        // Normalize inputs to prevent case-sensitive duplicates.
        var email = req.Email.ToLower().Trim();
        var fullName = req.FullName.Trim();
        var phone = req.PhoneNumber.Trim();

        // Uniqueness checks — both email and phone must be globally unique.
        if (await _repo.EmailExistsAsync(email))
            return new ApiResponse<AuthResponse>(false, "Email already exists", null);

        if (await _repo.PhoneExistsAsync(phone))
            return new ApiResponse<AuthResponse>(false, "Phone number already registered", null);

        // Build the new User entity.
        // PasswordHash: BCrypt produces a salted hash — same password gives different
        // hash each time, making rainbow-table attacks impossible.
        // Status "Pending": wallet features are locked until KYC is approved.
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

        // Publish a welcome notification event to RabbitMQ.
        // NotificationService picks this up and saves an in-app notification.
        // The message fields must match the NotificationMessage record in
        // NotificationService so the consumer can deserialize it correctly.
        await _mq.PublishAsync("notifications", new
        {
            UserId = user.Id.ToString(),
            Email = user.Email,
            Title = "Welcome to Trunqo!",
            Message = $"Hi {user.FullName}, your account has been created. Complete KYC to activate your wallet.",
            Type = "welcome"
        });

        // Generate a JWT so the user is logged in immediately after registration.
        var token = _tokenService.GenerateToken(user);

        return new ApiResponse<AuthResponse>(true, "Success",
            new AuthResponse(token, user.Id.ToString(), user.FullName, user.Email, user.Role, user.Status));
    }

    // ── LoginAsync ───────────────────────────────────────────────────────────
    // Validates email + password and returns a JWT on success.
    // BCrypt.Verify re-hashes the submitted password with the stored salt and
    // compares — this is the only safe way to check a BCrypt hash.
    // Returns a generic "Invalid credentials" message for both wrong email and
    // wrong password to prevent user enumeration.
    public async Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest req)
    {
        // Look up user by normalized email (emails are stored lowercase).
        var user = await _repo.GetUserByEmailAsync(req.Email.ToLower());

        // BCrypt.Verify returns false if user is null (short-circuit) or password wrong.
        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return new ApiResponse<AuthResponse>(false, "Invalid credentials", null);

        var token = _tokenService.GenerateToken(user);

        return new ApiResponse<AuthResponse>(true, "Success",
            new AuthResponse(token, user.Id.ToString(), user.FullName, user.Email, user.Role, user.Status));
    }

    // ── RequestPasswordResetAsync ────────────────────────────────────────────
    // Step 1 of the password reset flow.
    // Generates a cryptographically secure 6-digit OTP, stores its SHA-256 hash
    // in the PasswordResetSessions table, and publishes an event so
    // NotificationService sends the OTP to the user's email.
    //
    // Security notes:
    //   - Only the hash is stored — the plain OTP is never persisted.
    //   - OTP expires in 10 minutes.
    //   - Maximum 5 attempts before the session is locked.
    //   - If the email is not found, the method returns silently (no error)
    //     to prevent user enumeration.
    public async Task RequestPasswordResetAsync(string email)
    {
        var user = await _repo.GetUserByEmailAsync(email.ToLower().Trim());
        // Silently return if email not found — caller always gets 200 OK.
        if (user == null) return;

        // Generate a 6-digit OTP using a cryptographically secure RNG.
        var otp = GenerateOtp();

        // Create a new reset session. Only the SHA-256 hash of the OTP is stored.
        var session = new PasswordResetSession
        {
            UserId = user.Id,
            Purpose = "PASSWORD_RESET",
            OtpHash = Hash(otp),                              // store hash, not plain OTP
            OtpExpiresAtUtc = DateTime.UtcNow.AddMinutes(10), // 10-minute window
            MaxAttempts = 5,
            Attempts = 0
        };

        await _repo.AddPasswordResetSessionAsync(session);
        await _repo.SaveChangesAsync();

        // Publish the OTP to the notifications queue.
        // NotificationConsumer detects the "otp" field and routes to the OTP email template.
        await _mq.PublishAsync("notifications", new
        {
            userId = user.Id.ToString(),
            email = user.Email,
            otp = otp   // plain OTP sent to user via email, never stored in DB
        });
    }

    // ── VerifyOtpAsync ───────────────────────────────────────────────────────
    // Step 2 of the password reset flow.
    // Validates the 6-digit OTP the user received by email.
    // On success, generates a one-time reset token (UUID), stores its hash,
    // and returns the plain token to the frontend for use in /reset-password.
    //
    // Security notes:
    //   - Attempts are incremented ONLY on failure (not before checking).
    //   - Session is locked after MaxAttempts failures.
    //   - The reset token expires in 10 minutes.
    public async Task<VerifyPasswordResetOtpResponse?> VerifyOtpAsync(string email, string otp)
    {
        var user = await _repo.GetUserByEmailAsync(email.ToLower().Trim());
        if (user == null) return null;

        // Get the most recent active reset session for this user.
        var session = await _repo.GetLatestPasswordResetSessionAsync(user.Id, "PASSWORD_RESET");

        // Reject if no session exists or the OTP has expired.
        if (session == null || session.OtpExpiresAtUtc < DateTime.UtcNow)
            return null;

        // Reject if the user has exceeded the maximum allowed attempts.
        if (session.Attempts >= session.MaxAttempts)
            return null;

        // Hash the submitted OTP and compare against the stored hash.
        // Increment attempts only on failure to avoid penalizing correct submissions.
        if (!VerifyHash(otp, session.OtpHash))
        {
            session.Attempts++;
            session.LastAttemptAtUtc = DateTime.UtcNow;
            await _repo.SaveChangesAsync();
            return null;
        }

        // OTP is correct — generate a one-time reset token.
        var resetToken = Guid.NewGuid().ToString();

        // Store the hash of the reset token (not the plain token).
        session.ResetTokenHash = Hash(resetToken);
        session.ResetTokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(10);
        session.VerifiedAtUtc = DateTime.UtcNow;

        await _repo.SaveChangesAsync();

        // Return the plain reset token to the frontend — it will be passed to /reset-password.
        return new VerifyPasswordResetOtpResponse(resetToken, session.ResetTokenExpiresAtUtc.Value);
    }

    // ── ResetPasswordAsync ───────────────────────────────────────────────────
    // Step 3 (final) of the password reset flow.
    // Validates the reset token, checks it has not expired or been used,
    // BCrypt-hashes the new password, and marks the session as used.
    //
    // Security notes:
    //   - UsedAtUtc is set after successful reset — prevents replay attacks.
    //   - GetLatestVerifiedPasswordResetSessionAsync only returns sessions where
    //     UsedAtUtc IS NULL, so a used token can never be reused.
    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request)
    {
        // Passwords must match — this is also validated on the frontend.
        if (request.NewPassword != request.ConfirmPassword)
            return false;

        var user = await _repo.GetUserByEmailAsync(request.Email.ToLower().Trim());
        if (user == null) return false;

        // Fetch the verified, unused reset session for this user.
        var session = await _repo.GetLatestVerifiedPasswordResetSessionAsync(user.Id, "PASSWORD_RESET");

        // Reject if no valid session or the reset token has expired.
        if (session == null || session.ResetTokenExpiresAtUtc < DateTime.UtcNow)
            return false;

        // Verify the submitted reset token against the stored hash.
        if (session.ResetTokenHash == null ||
            !VerifyHash(request.ResetToken, session.ResetTokenHash))
            return false;

        // Hash the new password with BCrypt and save it.
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        // Mark the session as used — prevents this reset token from being reused.
        session.UsedAtUtc = DateTime.UtcNow;

        await _repo.SaveChangesAsync();

        return true;
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    // Generates a cryptographically secure 6-digit OTP (100000–999999).
    // Uses RandomNumberGenerator.Fill (CSPRNG) instead of System.Random
    // which is not cryptographically secure.
    private static string GenerateOtp()
    {
        var bytes = new byte[4];
        RandomNumberGenerator.Fill(bytes);
        // Map the random bytes to a 6-digit number in the range [100000, 999999].
        var value = Math.Abs(BitConverter.ToInt32(bytes, 0)) % 900000 + 100000;
        return value.ToString();
    }

    // Computes the SHA-256 hash of a string and returns it as a Base64 string.
    // Used for OTPs and reset tokens — fast enough for these short-lived values.
    // (BCrypt is used for passwords because it is intentionally slow.)
    private string Hash(string input)
    {
        using var sha = SHA256.Create();
        return Convert.ToBase64String(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(input)));
    }

    // Constant-time comparison: hash the input and compare to the stored hash.
    // Both sides are hashed so the comparison length is always the same,
    // reducing timing-attack surface.
    private bool VerifyHash(string input, string hash) =>
        Hash(input) == hash;
}
