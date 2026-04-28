using AuthService.Common.Exceptions;
using AuthService.DTOs;
using AuthService.Repositories;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AuthService.Controllers;

[ApiController]
[Route("api/auth")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IAuthRepository _repo;
    private readonly IRabbitMqPublisher _mq;

    public UserController(IAuthRepository repo, IRabbitMqPublisher mq)
    {
        _repo = repo;
        _mq = mq;
    }

    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var user = await _repo.GetUserByIdAsync(CurrentUserId, includeKyc: true);
        if (user == null)
            throw new NotFoundAppException("User not found.");

        return Ok(new ApiResponse<UserProfileResponse>(true, "OK", MapProfile(user)));
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateUserRequest req)
    {
        var user = await _repo.GetUserByIdAsync(CurrentUserId);
        if (user == null)
            throw new NotFoundAppException("User not found.");

        var email = req.Email.ToLower().Trim();
        var fullName = req.FullName.Trim();
        var phone = req.PhoneNumber.Trim();

        if (await _repo.EmailExistsAsync(email, excludeUserId: CurrentUserId))
            throw new ConflictAppException("Email already in use.");

        if (await _repo.PhoneExistsAsync(phone, excludeUserId: CurrentUserId))
            throw new ConflictAppException("Phone number already in use.");

        user.FullName = fullName;
        user.Email = email;
        user.PhoneNumber = phone;
        await _repo.SaveChangesAsync();

        return Ok(new ApiResponse<UserProfileResponse>(true, "Profile updated.", MapProfile(user)));
    }

    [HttpPost("kyc/submit")]
    [HttpPost("kyc")]  // gateway alias
    public async Task<IActionResult> SubmitKyc([FromBody] KycSubmitRequest req)
    {
        var user = await _repo.GetUserByIdAsync(CurrentUserId, includeKyc: true);
        if (user == null)
            throw new NotFoundAppException("User not found.");

        if (string.IsNullOrWhiteSpace(req.DocumentType) || string.IsNullOrWhiteSpace(req.DocumentNumber))
            throw new AppValidationException("Document type and number are required.");

        if (user.KycDocument != null)
        {
            // Re-submission: update existing
            user.KycDocument.DocumentType = req.DocumentType;
            user.KycDocument.DocumentNumber = req.DocumentNumber;
            user.KycDocument.Status = "Pending";
            user.KycDocument.AdminNote = null;
            user.KycDocument.ReviewedAt = null;
            user.KycDocument.SubmittedAt = DateTime.UtcNow;
        }
        else
        {
            var kyc = new Models.KycDocument
            {
                Id = Guid.NewGuid(),
                UserId = CurrentUserId,
                DocumentType = req.DocumentType,
                DocumentNumber = req.DocumentNumber,
                Status = "Pending",
                SubmittedAt = DateTime.UtcNow
            };
            await _repo.AddKycDocumentAsync(kyc);
        }

        user.Status = "Pending";
        await _repo.SaveChangesAsync();

        // Notify AdminService via RabbitMQ
        await _mq.PublishAsync("kyc_submissions", new
        {
            UserId = CurrentUserId.ToString(),
            FullName = user.FullName,
            Email = user.Email,
            DocumentType = req.DocumentType,
            DocumentNumber = req.DocumentNumber,
            SubmittedAt = DateTime.UtcNow
        });

        return Ok(new ApiResponse<object>(true, "KYC submitted successfully.", null));
    }

    // ── Internal endpoints (called by other services) ──────────────────────

    [AllowAnonymous]
    [HttpGet("internal/user/{userId}")]
    public async Task<IActionResult> GetUserInternal(Guid userId)
    {
        if (!IsInternalRequest() && !IsAdminJwt())
            return Unauthorized(new { success = false, message = "Unauthorized." });

        var user = await _repo.GetUserByIdAsync(userId, includeKyc: true);
        if (user == null)
            return NotFound(new { success = false, message = "User not found." });

        return Ok(new ApiResponse<AuthUserInternalResponse>(true, "OK", MapInternal(user)));
    }

    [AllowAnonymous]
    [HttpGet("internal/user-by-email")]
    public async Task<IActionResult> GetUserByEmailInternal([FromQuery] string email)
    {
        if (!IsInternalRequest() && !IsAdminJwt())
            return Unauthorized(new { success = false, message = "Unauthorized." });

        var user = await _repo.GetUserByEmailAsync(email.ToLower().Trim(), includeKyc: true);
        if (user == null)
            return NotFound(new { success = false, message = "User not found." });

        return Ok(new ApiResponse<AuthUserInternalResponse>(true, "OK", MapInternal(user)));
    }

    // Allows any authenticated user to look up another user's display name by email
    // Used by the Transfer page to show receiver's name
    [HttpGet("lookup-by-email")]
    public async Task<IActionResult> LookupUserByEmail([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { success = false, message = "Email is required." });

        var user = await _repo.GetUserByEmailAsync(email.ToLower().Trim());
        if (user == null)
            return NotFound(new { success = false, message = "User not found." });

        // Only return safe public fields — no sensitive data
        return Ok(new ApiResponse<object>(true, "OK", new
        {
            userId = user.Id,
            fullName = user.FullName,
            email = user.Email
        }));
    }

    [AllowAnonymous]
    [HttpGet("internal/users")]
    public async Task<IActionResult> GetAllUsersInternal()
    {
        // Allow both: admin JWT token OR internal service API key
        if (!IsInternalRequest() && !IsAdminJwt())
            return Unauthorized(new { success = false, message = "Unauthorized." });

        var users = await _repo.GetUsersByRoleAsync("User", includeKyc: true);
        var data = users.Select(MapProfile).ToList();
        return Ok(new ApiResponse<List<UserProfileResponse>>(true, "OK", data));
    }

    [AllowAnonymous]
    [HttpPost("internal/user/{userId}/kyc-decision")]
    public async Task<IActionResult> KycDecisionInternal(Guid userId, [FromBody] KycDecisionInternalRequest req)
    {
        if (!IsInternalRequest())
            return Unauthorized(new { success = false, message = "Unauthorized." });

        var user = await _repo.GetUserByIdAsync(userId, includeKyc: true);
        if (user == null)
            return NotFound(new { success = false, message = "User not found." });

        var newStatus = req.Decision == "Approved" ? "Active" : "Rejected";
        user.Status = newStatus;

        if (user.KycDocument != null)
        {
            user.KycDocument.Status = req.Decision;
            user.KycDocument.AdminNote = req.AdminNote;
            user.KycDocument.ReviewedAt = DateTime.UtcNow;
        }

        await _repo.SaveChangesAsync();
        return Ok(new { success = true, message = "User status updated." });
    }

    // Called by admin panel to update user profile
    [AllowAnonymous]
    [HttpPut("internal/user/{userId}")]
    public async Task<IActionResult> UpdateUserInternal(Guid userId, [FromBody] UpdateUserInternalRequest req)
    {
        if (!IsInternalRequest() && !IsAdminJwt())
            return Unauthorized(new { success = false, message = "Unauthorized." });

        var user = await _repo.GetUserByIdAsync(userId);
        if (user == null)
            return NotFound(new ApiResponse<object>(false, "User not found.", null));

        var email = req.Email.ToLower().Trim();
        var fullName = req.FullName.Trim();
        var phone = req.PhoneNumber.Trim();

        if (await _repo.EmailExistsAsync(email, excludeUserId: userId))
            return Conflict(new ApiResponse<object>(false, "Email already in use.", null));

        if (await _repo.PhoneExistsAsync(phone, excludeUserId: userId))
            return Conflict(new ApiResponse<object>(false, "Phone number already in use.", null));

        user.FullName = fullName;
        user.Email = email;
        user.PhoneNumber = phone;
        await _repo.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, "User updated.", null));
    }

    // Called by admin panel to delete a user
    [AllowAnonymous]
    [HttpDelete("internal/user/{userId}")]
    public async Task<IActionResult> DeleteUserInternal(Guid userId)
    {
        if (!IsInternalRequest() && !IsAdminJwt())
            return Unauthorized(new { success = false, message = "Unauthorized." });

        var user = await _repo.GetUserByIdAsync(userId, includeKyc: true);
        if (user == null)
            return NotFound(new ApiResponse<object>(false, "User not found.", null));

        if (user.KycDocument != null)
            _repo.RemoveKycDocument(user.KycDocument);

        _repo.RemoveUser(user);
        await _repo.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, "User deleted.", null));
    }

    private bool IsInternalRequest()
    {
        var config = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expectedKey = config["InternalApiKey"] ?? "TrunqoInternalKey2024";
        return Request.Headers.TryGetValue("X-Internal-Api-Key", out var key) && key == expectedKey;
    }

    private bool IsAdminJwt()
    {
        return User.Identity?.IsAuthenticated == true &&
               User.IsInRole("Admin");
    }

    private static UserProfileResponse MapProfile(Models.User user) =>
        new(
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.Status,
            user.Role,
            user.KycDocument == null ? null : new KycResponse(
                user.KycDocument.Id,
                user.KycDocument.DocumentType,
                user.KycDocument.DocumentNumber,
                user.KycDocument.Status,
                user.KycDocument.AdminNote,
                user.KycDocument.SubmittedAt,
                user.KycDocument.ReviewedAt)
        );

    private static AuthUserInternalResponse MapInternal(Models.User user) =>
        new(user.Id, user.FullName, user.Email, user.PhoneNumber, user.Status, user.Role);
}

public record AuthUserInternalResponse(
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string Status,
    string Role
);

public record KycDecisionInternalRequest(
    string Decision,
    string? AdminNote
);

public record UpdateUserInternalRequest(
    string FullName,
    string Email,
    string PhoneNumber
);
