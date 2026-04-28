using AdminService.DTOs;
using AdminService.Models;
using AdminService.Repositories;
using System.Net.Http.Json;
using System.Text.Json;

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
    private readonly IAdminRepository _repo;
    private readonly IRabbitMqPublisher _mq;
    private readonly IHttpClientFactory _httpFactory;
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

    private HttpClient CreateAuthClient()
    {
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        var http = new HttpClient(handler)
        {
            BaseAddress = new Uri(_config["AuthService:BaseUrl"]!)
        };
        http.DefaultRequestHeaders.Add(
            "X-Internal-Api-Key",
            _config["InternalApiKey"] ?? "TrunqoInternalKey");
        return http;
    }

    public async Task<ApiResponse<AdminLoginResponse>> LoginAsync(AdminLoginRequest req)
    {
        using var http = CreateAuthClient();
        var response = await http.GetAsync($"/api/auth/internal/user-by-email?email={req.Email}");
        if (!response.IsSuccessStatusCode)
            return new ApiResponse<AdminLoginResponse>(false, "Invalid credentials.", null);

        var json = await response.Content.ReadAsStringAsync();
        var data = JsonSerializer.Deserialize<AuthUserResponse>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (data?.Data == null || data.Data.Role != "Admin")
            return new ApiResponse<AdminLoginResponse>(false, "Not an admin account.", null);

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

        return new ApiResponse<AdminLoginResponse>(
            true,
            "Login successful.",
            new AdminLoginResponse(
                loginData.Data.Token,
                loginData.Data.UserId,
                loginData.Data.FullName,
                loginData.Data.Email));
    }

    public async Task<ApiResponse<List<KycReviewResponse>>> GetPendingKycAsync()
    {
        await SyncKycFromAuthAsync();
        var reviews = await _repo.GetPendingKycReviewsAsync();
        return new ApiResponse<List<KycReviewResponse>>(true, "OK", reviews.Select(MapKycReview).ToList());
    }

    public async Task<ApiResponse<object>> DecideKycAsync(Guid kycId, Guid adminId, KycDecisionRequest req)
    {
        if (req.Decision != "Approved" && req.Decision != "Rejected")
            return new ApiResponse<object>(false, "Decision must be Approved or Rejected.", null);

        var review = await _repo.GetKycReviewByIdAsync(kycId);
        if (review == null)
            return new ApiResponse<object>(false, "KYC review not found.", null);

        if (review.Status != "Pending")
            return new ApiResponse<object>(false, "KYC already reviewed.", null);

        review.Status = req.Decision;
        review.AdminNote = req.AdminNote;
        review.ReviewedBy = adminId;
        review.ReviewedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync();

        using var http = CreateAuthClient();
        var authUpdateResponse = await http.PostAsJsonAsync(
            $"/api/auth/internal/user/{review.UserId}/kyc-decision",
            new { Decision = req.Decision, AdminNote = req.AdminNote });

        if (!authUpdateResponse.IsSuccessStatusCode)
            return new ApiResponse<object>(false, "KYC review saved, but user status sync failed in AuthService.", null);

        _mq.Publish("kyc_decisions", new
        {
            UserId = review.UserId.ToString(),
            Decision = req.Decision,
            AdminNote = req.AdminNote
        });

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

    public async Task<ApiResponse<List<SupportTicketResponse>>> GetTicketsAsync()
    {
        var tickets = await _repo.GetAllTicketsAsync();
        return new ApiResponse<List<SupportTicketResponse>>(true, "OK", tickets.Select(MapTicket).ToList());
    }

    public async Task<ApiResponse<object>> ReplyTicketAsync(Guid ticketId, Guid adminId, TicketReplyRequest req)
    {
        var ticket = await _repo.GetTicketByIdAsync(ticketId);
        if (ticket == null)
            return new ApiResponse<object>(false, "Ticket not found.", null);

        ticket.AdminReply = req.Reply;
        ticket.Status = "Responded";
        ticket.RespondedBy = adminId;
        ticket.RespondedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync();

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

    public async Task<ApiResponse<object>> SubmitTicketAsync(Guid userId, SubmitTicketRequest req)
    {
        using var http = CreateAuthClient();
        var response = await http.GetAsync($"/api/auth/internal/user/{userId}");
        var userEmail = "unknown@email.com";
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<AuthUserResponse>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
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

        await _repo.AddTicketAsync(ticket);
        await _repo.SaveChangesAsync();

        return new ApiResponse<object>(true, "Ticket submitted successfully.", null);
    }

    public async Task<ApiResponse<List<SupportTicketResponse>>> GetMyTicketsAsync(Guid userId)
    {
        var tickets = await _repo.GetTicketsByUserIdAsync(userId);
        return new ApiResponse<List<SupportTicketResponse>>(true, "OK", tickets.Select(MapTicket).ToList());
    }

    private static KycReviewResponse MapKycReview(KycReview review) =>
        new(review.Id, review.UserId, review.UserFullName, review.UserEmail,
            review.DocumentType, review.DocumentNumber, review.Status,
            review.AdminNote, review.SubmittedAt, review.ReviewedAt);

    private static SupportTicketResponse MapTicket(SupportTicket ticket) =>
        new(ticket.Id, ticket.UserId, ticket.UserEmail, ticket.Subject, ticket.Message,
            ticket.Status, ticket.AdminReply, ticket.CreatedAt, ticket.RespondedAt);

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
                if (user.Kyc == null)
                    continue;

                var existing = await _repo.GetKycReviewByUserIdAsync(user.UserId);
                if (existing == null)
                {
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
            // Non-blocking sync fallback; core API should still respond.
        }
    }
}

public record AuthUserResponse(bool Success, string Message, AuthUserData? Data);
public record AuthUserData(Guid UserId, string FullName, string Email,
                           string PhoneNumber, string Status, string Role);
public record AuthLoginResponse(bool Success, string Message, AuthTokenData? Data);
public record AuthTokenData(string Token, string UserId, string FullName,
                            string Email, string Role, string Status);
public record AuthUsersResponse(bool Success, string Message, List<AuthUserProfileData>? Data);
public record AuthUserProfileData(
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string Status,
    string Role,
    AuthKycData? Kyc);
public record AuthKycData(
    Guid Id,
    string DocumentType,
    string DocumentNumber,
    string Status,
    string? AdminNote,
    DateTime SubmittedAt,
    DateTime? ReviewedAt);
