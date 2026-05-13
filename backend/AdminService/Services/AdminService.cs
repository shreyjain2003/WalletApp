// ============================================================
// AdminService.cs — AdminService
// ------------------------------------------------------------
// Core business logic for admin operations and support tickets.
// This service is called by AdminController and handles:
//
//   LoginAsync         — proxy admin login through AuthService
//   GetPendingKycAsync — sync + return pending KYC reviews
//   DecideKycAsync     — approve/reject KYC, sync to AuthService, publish events
//   GetTicketsAsync    — return all support tickets
//   ReplyTicketAsync   — add admin reply, publish notification
//   SubmitTicketAsync  — create a new support ticket (any user)
//   GetMyTicketsAsync  — return tickets for a specific user
//
// AdminService does NOT have its own user database — it calls AuthService
// via HTTP for user data. It maintains its own KycReviews and SupportTickets
// tables in a separate SQL Server database.
// ============================================================

using AdminService.DTOs;
using AdminService.Models;
using AdminService.Repositories;
using System.Net.Http.Json;
using System.Text.Json;

namespace AdminService.Services;

// Interface allows unit tests to inject a fake implementation.
public interface IAdminService
{
    Task<ApiResponse<AdminLoginResponse>> LoginAsync(AdminLoginRequest req);
    Task<ApiResponse<List<KycReviewResponse>>> GetPendingKycAsync();
    Task<ApiResponse<object>> DecideKycAsync(Guid kycId, Guid adminId, KycDecisionRequest req);
    Task<ApiResponse<List<SupportTicketResponse>>> GetTicketsAsync();
    Task<ApiResponse<object>> ReplyTicketAsync(Guid ticketId, Guid adminId, TicketReplyRequest req);
    Task<ApiResponse<object>> SubmitTicketAsync(Guid userId, SubmitTicketRequest req);
    Task<ApiResponse<List<SupportTicketResponse>>> GetMyTicketsAsync(Guid userId);
}

public class AdminService : IAdminService
{
    // IAdminRepository abstracts SQL operations for KycReviews and SupportTickets.
    private readonly IAdminRepository _repo;

    // IRabbitMqPublisher sends async events to RabbitMQ queues.
    private readonly IRabbitMqPublisher _mq;

    // IHttpClientFactory is registered but CreateAuthClient() creates its own
    // HttpClient per call to avoid socket exhaustion from long-lived clients.
    private readonly IHttpClientFactory _httpFactory;

    // IConfiguration reads AuthService:BaseUrl and InternalApiKey from appsettings.
    private readonly IConfiguration _config;

    public AdminService(IAdminRepository repo,
                        IConfiguration config,
                        IRabbitMqPublisher mq,
                        IHttpClientFactory httpFactory)
    {
        _repo = repo;
        _mq = mq;
        _httpFactory = httpFactory;
        _config = config;
    }

    // ── CreateAuthClient ─────────────────────────────────────────────────────
    // Creates a new HttpClient per call (not reused) to avoid socket exhaustion.
    // DangerousAcceptAnyServerCertificateValidator is used because AuthService
    // runs on HTTPS with a self-signed development certificate locally.
    // The X-Internal-Api-Key header authenticates this service-to-service call.
    private HttpClient CreateAuthClient()
    {
        var handler = new HttpClientHandler
        {
            // Accept self-signed certificates in development.
            // In production, replace with proper certificate validation.
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        var http = new HttpClient(handler)
        {
            BaseAddress = new Uri(_config["AuthService:BaseUrl"]!)
        };
        // Shared secret key that AuthService checks to allow internal calls.
        http.DefaultRequestHeaders.Add(
            "X-Internal-Api-Key",
            _config["InternalApiKey"] ?? "TrunqoInternalKey2024");
        return http;
    }

    // ── LoginAsync ───────────────────────────────────────────────────────────
    // Admin login is proxied through AuthService:
    //   1. Look up the user by email via AuthService's internal endpoint.
    //   2. Verify the user has Role = "Admin" — reject regular users.
    //   3. Call AuthService /login with the credentials to get a JWT.
    //   4. Return the JWT to the admin panel frontend.
    // This approach means AdminService never stores passwords — AuthService
    // is the single source of truth for authentication.
    public async Task<ApiResponse<AdminLoginResponse>> LoginAsync(AdminLoginRequest req)
    {
        using var http = CreateAuthClient();

        // Step 1: Look up the user by email to check their role.
        var response = await http.GetAsync($"/api/auth/internal/user-by-email?email={req.Email}");
        if (!response.IsSuccessStatusCode)
            return new ApiResponse<AdminLoginResponse>(false, "Invalid credentials.", null);

        var json = await response.Content.ReadAsStringAsync();
        var data = JsonSerializer.Deserialize<AuthUserResponse>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        // Step 2: Reject if the account is not an Admin.
        if (data?.Data == null || data.Data.Role != "Admin")
            return new ApiResponse<AdminLoginResponse>(false, "Not an admin account.", null);

        // Step 3: Validate the password by calling AuthService's login endpoint.
        var loginResponse = await http.PostAsJsonAsync("/api/auth/login", new
        {
            Email = req.Email,
            Password = req.Password
        });

        if (!loginResponse.IsSuccessStatusCode)
            return new ApiResponse<AdminLoginResponse>(false, "Invalid credentials.", null);

        var loginJson = await loginResponse.Content.ReadAsStringAsync();
        var loginData = JsonSerializer.Deserialize<AuthLoginResponse>(loginJson, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (loginData?.Data == null)
            return new ApiResponse<AdminLoginResponse>(false, "Login failed.", null);

        // Step 4: Return the JWT and admin info to the frontend.
        return new ApiResponse<AdminLoginResponse>(
            true,
            "Login successful.",
            new AdminLoginResponse(
                loginData.Data.Token,
                loginData.Data.UserId,
                loginData.Data.FullName,
                loginData.Data.Email));
    }

    // ── GetPendingKycAsync ───────────────────────────────────────────────────
    // Returns all KYC submissions with Status = "Pending".
    // Calls SyncKycFromAuthAsync first to pull any new submissions from AuthService
    // that may not have arrived via RabbitMQ (e.g. if RabbitMQ was down).
    public async Task<ApiResponse<List<KycReviewResponse>>> GetPendingKycAsync()
    {
        // Sync from AuthService to catch any missed RabbitMQ messages.
        await SyncKycFromAuthAsync();
        var reviews = await _repo.GetPendingKycReviewsAsync();
        return new ApiResponse<List<KycReviewResponse>>(true, "OK", reviews.Select(MapKycReview).ToList());
    }

    // ── DecideKycAsync ───────────────────────────────────────────────────────
    // Processes an admin's KYC approval or rejection decision.
    // Steps:
    //   1. Validate the decision value.
    //   2. Update the KycReview record in AdminService's database.
    //   3. Call AuthService to update the User's Status and KycDocument.
    //   4. Publish kyc_decisions event → WalletService creates wallet (if approved).
    //   5. Publish notification event → user receives email/in-app alert.
    public async Task<ApiResponse<object>> DecideKycAsync(Guid kycId, Guid adminId, KycDecisionRequest req)
    {
        // Validate the decision value — only "Approved" or "Rejected" are valid.
        if (req.Decision != "Approved" && req.Decision != "Rejected")
            return new ApiResponse<object>(false, "Decision must be Approved or Rejected.", null);

        var review = await _repo.GetKycReviewByIdAsync(kycId);
        if (review == null)
            return new ApiResponse<object>(false, "KYC review not found.", null);

        // Prevent double-reviewing — a KYC can only be decided once.
        if (review.Status != "Pending")
            return new ApiResponse<object>(false, "KYC already reviewed.", null);

        // Update the review record in AdminService's database.
        review.Status = req.Decision;
        review.AdminNote = req.AdminNote;
        review.ReviewedBy = adminId;
        review.ReviewedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync();

        // Sync the decision to AuthService so the User's Status is updated there too.
        using var http = CreateAuthClient();
        var authUpdateResponse = await http.PostAsJsonAsync(
            $"/api/auth/internal/user/{review.UserId}/kyc-decision",
            new { Decision = req.Decision, AdminNote = req.AdminNote });

        if (!authUpdateResponse.IsSuccessStatusCode)
            return new ApiResponse<object>(false, "KYC review saved, but user status sync failed in AuthService.", null);

        // Publish to kyc_decisions queue:
        //   - WalletService's KycApprovalConsumer creates a wallet (if Approved)
        //   - AuthService's KycDecisionConsumer updates User.Status (redundant but safe)
        _mq.Publish("kyc_decisions", new
        {
            UserId = review.UserId.ToString(),
            Decision = req.Decision,
            AdminNote = req.AdminNote
        });

        // Publish a notification so the user receives an email and in-app alert.
        _mq.Publish("notifications", new
        {
            UserId = review.UserId.ToString(),
            Email = review.UserEmail,
            Title = $"KYC {req.Decision}",
            Message = req.Decision == "Approved"
                ? "Your KYC has been approved. Your wallet is now active!"
                : $"Your KYC was rejected. Reason: {req.AdminNote}",
            Type = "kyc_decision"
        });

        return new ApiResponse<object>(true, $"KYC {req.Decision} successfully.", null);
    }

    // ── GetTicketsAsync ──────────────────────────────────────────────────────
    // Returns all support tickets from all users, ordered newest-first.
    // Used by the admin ticket management panel.
    public async Task<ApiResponse<List<SupportTicketResponse>>> GetTicketsAsync()
    {
        var tickets = await _repo.GetAllTicketsAsync();
        return new ApiResponse<List<SupportTicketResponse>>(true, "OK", tickets.Select(MapTicket).ToList());
    }

    // ── ReplyTicketAsync ─────────────────────────────────────────────────────
    // Adds an admin reply to a support ticket.
    // Updates the ticket status to "Responded" and publishes a notification
    // so the user knows their ticket has been answered.
    public async Task<ApiResponse<object>> ReplyTicketAsync(Guid ticketId, Guid adminId, TicketReplyRequest req)
    {
        var ticket = await _repo.GetTicketByIdAsync(ticketId);
        if (ticket == null)
            return new ApiResponse<object>(false, "Ticket not found.", null);

        // Update the ticket with the admin's reply.
        ticket.AdminReply = req.Reply;
        ticket.Status = "Responded";
        ticket.RespondedBy = adminId;
        ticket.RespondedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync();

        // Notify the user that their ticket has been responded to.
        _mq.Publish("notifications", new
        {
            UserId = ticket.UserId.ToString(),
            Email = ticket.UserEmail,
            Title = "Support Ticket Responded",
            Message = $"Your ticket '{ticket.Subject}' has been responded to.",
            Type = "ticket_reply"
        });

        return new ApiResponse<object>(true, "Reply sent successfully.", null);
    }

    // ── SubmitTicketAsync ────────────────────────────────────────────────────
    // Creates a new support ticket for the given user.
    // Calls AuthService to look up the user's email so it can be stored
    // with the ticket for admin reference (admins see the email in the ticket list).
    public async Task<ApiResponse<object>> SubmitTicketAsync(Guid userId, SubmitTicketRequest req)
    {
        // Look up the user's email from AuthService.
        using var http = CreateAuthClient();
        var response = await http.GetAsync($"/api/auth/internal/user/{userId}");
        var userEmail = "unknown@email.com"; // fallback if AuthService is unavailable
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<AuthUserResponse>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            userEmail = data?.Data?.Email ?? userEmail;
        }

        // Create and persist the ticket.
        var ticket = new SupportTicket
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            UserEmail = userEmail,
            Subject = req.Subject,
            Message = req.Message,
            Status = "Open",
            CreatedAt = DateTime.UtcNow
        };

        await _repo.AddTicketAsync(ticket);
        await _repo.SaveChangesAsync();

        return new ApiResponse<object>(true, "Ticket submitted successfully.", null);
    }

    // ── GetMyTicketsAsync ────────────────────────────────────────────────────
    // Returns all tickets submitted by a specific user, ordered newest-first.
    // Used by the Support page to show the user their own ticket history.
    public async Task<ApiResponse<List<SupportTicketResponse>>> GetMyTicketsAsync(Guid userId)
    {
        var tickets = await _repo.GetTicketsByUserIdAsync(userId);
        return new ApiResponse<List<SupportTicketResponse>>(true, "OK", tickets.Select(MapTicket).ToList());
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    // Maps a KycReview entity to a KycReviewResponse DTO for the API response.
    private static KycReviewResponse MapKycReview(KycReview review) =>
        new(review.Id, review.UserId, review.UserFullName, review.UserEmail,
            review.DocumentType, review.DocumentNumber, review.Status,
            review.AdminNote, review.SubmittedAt, review.ReviewedAt);

    // Maps a SupportTicket entity to a SupportTicketResponse DTO.
    private static SupportTicketResponse MapTicket(SupportTicket ticket) =>
        new(ticket.Id, ticket.UserId, ticket.UserEmail, ticket.Subject, ticket.Message,
            ticket.Status, ticket.AdminReply, ticket.CreatedAt, ticket.RespondedAt);

    // ── SyncKycFromAuthAsync ─────────────────────────────────────────────────
    // Pulls all users with KYC documents from AuthService and upserts them
    // into AdminService's KycReviews table.
    // This is a fallback sync in case RabbitMQ messages were missed
    // (e.g. AdminService was down when a user submitted KYC).
    // Called before GetPendingKycAsync to ensure the list is up to date.
    // Errors are swallowed — the core API response should not fail if sync fails.
    private async Task SyncKycFromAuthAsync()
    {
        try
        {
            using var http = CreateAuthClient();
            var response = await http.GetAsync("/api/auth/internal/users");
            if (!response.IsSuccessStatusCode)
                return;

            var json = await response.Content.ReadAsStringAsync();
            var users = JsonSerializer.Deserialize<AuthUsersResponse>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (users?.Data == null || users.Data.Count == 0)
                return;

            foreach (var user in users.Data)
            {
                // Skip users who have not submitted KYC.
                if (user.Kyc == null)
                    continue;

                var existing = await _repo.GetKycReviewByUserIdAsync(user.UserId);
                if (existing == null)
                {
                    // New KYC submission not yet in AdminService's database — insert it.
                    await _repo.AddKycReviewAsync(new KycReview
                    {
                        Id = Guid.NewGuid(),
                        UserId = user.UserId,
                        UserFullName = user.FullName,
                        UserEmail = user.Email,
                        DocumentType = user.Kyc.DocumentType,
                        DocumentNumber = user.Kyc.DocumentNumber,
                        Status = user.Kyc.Status,
                        AdminNote = user.Kyc.AdminNote,
                        SubmittedAt = user.Kyc.SubmittedAt,
                        ReviewedAt = user.Kyc.ReviewedAt
                    });
                    continue;
                }

                // Existing record — update all fields to stay in sync with AuthService.
                existing.UserFullName = user.FullName;
                existing.UserEmail = user.Email;
                existing.DocumentType = user.Kyc.DocumentType;
                existing.DocumentNumber = user.Kyc.DocumentNumber;
                existing.Status = user.Kyc.Status;
                existing.AdminNote = user.Kyc.AdminNote;
                existing.SubmittedAt = user.Kyc.SubmittedAt;
                existing.ReviewedAt = user.Kyc.ReviewedAt;
            }

            await _repo.SaveChangesAsync();
        }
        catch
        {
            // Non-blocking — sync failure should not prevent the admin from seeing tickets.
        }
    }
}

// ── Internal HTTP response records ───────────────────────────────────────────
// These records map to the JSON responses from AuthService's internal endpoints.
// PropertyNameCaseInsensitive = true in JsonSerializer handles camelCase/PascalCase.

// Wrapper for single-user responses from AuthService.
public record AuthUserResponse(bool Success, string Message, AuthUserData? Data);

// Core user data returned by AuthService internal endpoints.
public record AuthUserData(Guid UserId, string FullName, string Email,
                           string PhoneNumber, string Status, string Role);

// Wrapper for the login response from AuthService.
public record AuthLoginResponse(bool Success, string Message, AuthTokenData? Data);

// Token data returned after successful login.
public record AuthTokenData(string Token, string UserId, string FullName,
                            string Email, string Role, string Status);

// Wrapper for the list-all-users response from AuthService.
public record AuthUsersResponse(bool Success, string Message, List<AuthUserProfileData>? Data);

// Full user profile including KYC data — used for the sync operation.
public record AuthUserProfileData(
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string Status,
    string Role,
    AuthKycData? Kyc);

// KYC document data embedded in the user profile response.
public record AuthKycData(
    Guid Id,
    string DocumentType,
    string DocumentNumber,
    string Status,
    string? AdminNote,
    DateTime SubmittedAt,
    DateTime? ReviewedAt);
