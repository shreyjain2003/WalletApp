using AdminService.Data;
using AdminService.DTOs;
using AdminService.Models;
using Microsoft.EntityFrameworkCore;

namespace AdminService.Services;

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
    private readonly AdminDbContext _db;
    private readonly IConfiguration _config;
    private readonly IRabbitMqPublisher _mq;
    private readonly HttpClient _http;

    public AdminService(AdminDbContext db,
                    IConfiguration config,
                    IRabbitMqPublisher mq,
                    IHttpClientFactory httpFactory)
    {
        _db = db;
        _config = config;
        _mq = mq;

        // Bypass SSL certificate validation for local development
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        _http = new HttpClient(handler);
        _http.BaseAddress = new Uri(config["AuthService:BaseUrl"]!);
    }

    // ── ADMIN LOGIN ───────────────────────────────────────────────────────
    public async Task<ApiResponse<AdminLoginResponse>> LoginAsync(AdminLoginRequest req)
    {
        // 1. Get user by email from AuthService
        var response = await _http.GetAsync(
            $"/api/auth/internal/user-by-email?email={req.Email}");

        if (!response.IsSuccessStatusCode)
            return new ApiResponse<AdminLoginResponse>(false, "Invalid credentials.", null);

        var json = await response.Content.ReadAsStringAsync();
        var data = System.Text.Json.JsonSerializer.Deserialize<AuthUserResponse>(
            json, new System.Text.Json.JsonSerializerOptions
            { PropertyNameCaseInsensitive = true });

        if (data?.Data == null || data.Data.Role != "Admin")
            return new ApiResponse<AdminLoginResponse>(false, "Not an admin account.", null);

        // 2. Verify password via AuthService login endpoint
        var loginResponse = await _http.PostAsJsonAsync("/api/auth/login", new
        {
            Email = req.Email,
            Password = req.Password
        });

        if (!loginResponse.IsSuccessStatusCode)
            return new ApiResponse<AdminLoginResponse>(false, "Invalid credentials.", null);

        var loginJson = await loginResponse.Content.ReadAsStringAsync();
        var loginData = System.Text.Json.JsonSerializer.Deserialize<AuthLoginResponse>(
            loginJson, new System.Text.Json.JsonSerializerOptions
            { PropertyNameCaseInsensitive = true });

        if (loginData?.Data == null)
            return new ApiResponse<AdminLoginResponse>(false, "Login failed.", null);

        return new ApiResponse<AdminLoginResponse>(
            true, "Login successful.",
            new AdminLoginResponse(
                loginData.Data.Token,
                loginData.Data.UserId,
                loginData.Data.FullName,
                loginData.Data.Email));
    }

    // ── GET PENDING KYC ───────────────────────────────────────────────────
    public async Task<ApiResponse<List<KycReviewResponse>>> GetPendingKycAsync()
    {
        var reviews = await _db.KycReviews
            .Where(k => k.Status == "Pending")
            .OrderBy(k => k.SubmittedAt)
            .ToListAsync();

        var result = reviews.Select(k => new KycReviewResponse(
            k.Id, k.UserId, k.UserFullName, k.UserEmail,
            k.DocumentType, k.DocumentNumber, k.Status,
            k.AdminNote, k.SubmittedAt, k.ReviewedAt
        )).ToList();

        return new ApiResponse<List<KycReviewResponse>>(true, "OK", result);
    }

    // ── DECIDE KYC ────────────────────────────────────────────────────────
    public async Task<ApiResponse<object>> DecideKycAsync(
        Guid kycId, Guid adminId, KycDecisionRequest req)
    {
        if (req.Decision != "Approved" && req.Decision != "Rejected")
            return new ApiResponse<object>(false, "Decision must be Approved or Rejected.", null);

        var review = await _db.KycReviews.FindAsync(kycId);

        if (review == null)
            return new ApiResponse<object>(false, "KYC review not found.", null);

        if (review.Status != "Pending")
            return new ApiResponse<object>(false, "KYC already reviewed.", null);

        // Update local record
        review.Status = req.Decision;
        review.AdminNote = req.AdminNote;
        review.ReviewedBy = adminId;
        review.ReviewedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // Tell AuthService to update user status via RabbitMQ
        _mq.Publish("kyc_decisions", new
        {
            UserId = review.UserId.ToString(),
            Decision = req.Decision,
            AdminNote = req.AdminNote
        });

        // Notify user
        _mq.Publish("notifications", new
        {
            UserId = review.UserId.ToString(),
            Title = $"KYC {req.Decision}",
            Message = req.Decision == "Approved"
                ? "Your KYC has been approved. Your wallet is now active!"
                : $"Your KYC was rejected. Reason: {req.AdminNote}",
            Type = "kyc_decision"
        });

        return new ApiResponse<object>(true, $"KYC {req.Decision} successfully.", null);
    }

    // ── GET TICKETS ───────────────────────────────────────────────────────
    public async Task<ApiResponse<List<SupportTicketResponse>>> GetTicketsAsync()
    {
        var tickets = await _db.SupportTickets
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        var result = tickets.Select(t => new SupportTicketResponse(
            t.Id, t.UserId, t.UserEmail, t.Subject, t.Message,
            t.Status, t.AdminReply, t.CreatedAt, t.RespondedAt
        )).ToList();

        return new ApiResponse<List<SupportTicketResponse>>(true, "OK", result);
    }

    // ── REPLY TICKET ──────────────────────────────────────────────────────
    public async Task<ApiResponse<object>> ReplyTicketAsync(
        Guid ticketId, Guid adminId, TicketReplyRequest req)
    {
        var ticket = await _db.SupportTickets.FindAsync(ticketId);

        if (ticket == null)
            return new ApiResponse<object>(false, "Ticket not found.", null);

        ticket.AdminReply = req.Reply;
        ticket.Status = "Responded";
        ticket.RespondedBy = adminId;
        ticket.RespondedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _mq.Publish("notifications", new
        {
            UserId = ticket.UserId.ToString(),
            Title = "Support Ticket Responded",
            Message = $"Your ticket '{ticket.Subject}' has been responded to.",
            Type = "ticket_reply"
        });

        return new ApiResponse<object>(true, "Reply sent successfully.", null);
    }

    // ── SUBMIT TICKET ─────────────────────────────────────────────────────
    public async Task<ApiResponse<object>> SubmitTicketAsync(
        Guid userId, SubmitTicketRequest req)
    {
        // Get user email from AuthService
        var response = await _http.GetAsync(
            $"/api/auth/internal/user/{userId}");

        var userEmail = "unknown@email.com";
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync();
            var data = System.Text.Json.JsonSerializer.Deserialize<AuthUserResponse>(
                json, new System.Text.Json.JsonSerializerOptions
                { PropertyNameCaseInsensitive = true });
            userEmail = data?.Data?.Email ?? userEmail;
        }

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

        _db.SupportTickets.Add(ticket);
        await _db.SaveChangesAsync();

        return new ApiResponse<object>(true, "Ticket submitted successfully.", null);
    }

    // ── GET MY TICKETS ────────────────────────────────────────────────────
    public async Task<ApiResponse<List<SupportTicketResponse>>> GetMyTicketsAsync(Guid userId)
    {
        var tickets = await _db.SupportTickets
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        var result = tickets.Select(t => new SupportTicketResponse(
            t.Id, t.UserId, t.UserEmail, t.Subject, t.Message,
            t.Status, t.AdminReply, t.CreatedAt, t.RespondedAt
        )).ToList();

        return new ApiResponse<List<SupportTicketResponse>>(true, "OK", result);
    }
}

// ── Helper classes to deserialize AuthService responses ───────────────────
public record AuthUserResponse(bool Success, string Message, AuthUserData? Data);
public record AuthUserData(Guid UserId, string FullName, string Email,
                           string PhoneNumber, string Status, string Role);
public record AuthLoginResponse(bool Success, string Message, AuthTokenData? Data);
public record AuthTokenData(string Token, string UserId, string FullName,
                            string Email, string Role, string Status);