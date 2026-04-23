using NotificationService.DTOs;
using NotificationService.Models;
using NotificationService.Repositories;

namespace NotificationService.Services;

public interface INotificationService
{
    Task SaveAsync(Notification notification);
    Task<ApiResponse<object>> CreateInternalNotificationAsync(InternalNotificationRequest req);
    Task<ApiResponse<List<NotificationResponse>>> GetUserNotificationsAsync(string userId);
    Task<ApiResponse<object>> MarkAsReadAsync(Guid id);
    Task<ApiResponse<object>> CreateMoneyRequestNotificationAsync(
        string requesterUserId,
        string requesterName,
        string requesterEmail,
        MoneyRequestNotificationRequest req);
}

public class NotificationService : INotificationService
{
    private readonly INotificationRepository _repo;
    private readonly IEmailNotificationService _emailService;

    public NotificationService(
        INotificationRepository repo,
        IEmailNotificationService emailService)
    {
        _repo = repo;
        _emailService = emailService;
    }

    public Task SaveAsync(Notification notification) => _repo.SaveAsync(notification);

    public async Task<ApiResponse<object>> CreateInternalNotificationAsync(InternalNotificationRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.UserId))
            return new ApiResponse<object>(false, "UserId is required.", null);

        await _repo.SaveAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = req.UserId,
            Title = req.Title ?? string.Empty,
            Message = req.Message ?? string.Empty,
            Type = req.Type ?? string.Empty,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        try
        {
            await _emailService.SendNotificationEmailAsync(
                req.UserId,
                req.Email,
                req.Title ?? string.Empty,
                req.Message ?? string.Empty,
                req.Type,
                req.Amount,
                req.Reference,
                req.Note,
                req.CounterpartyName,
                req.CounterpartyEmail,
                req.BalanceAfter,
                req.OccurredAtUtc,
                req.Otp);
        }
        catch
        {
            // Keep notification saved even if email fails.
        }

        return new ApiResponse<object>(true, "Internal notification created.", null);
    }

    public async Task<ApiResponse<List<NotificationResponse>>> GetUserNotificationsAsync(string userId)
    {
        var notifications = await _repo.GetUserNotificationsAsync(userId);

        var result = notifications.Select(n => new NotificationResponse(
            n.Id, n.UserId, n.Title, n.Message,
            n.Type, n.IsRead, n.CreatedAt
        )).ToList();

        return new ApiResponse<List<NotificationResponse>>(true, "OK", result);
    }

    public async Task<ApiResponse<object>> MarkAsReadAsync(Guid id)
    {
        var updated = await _repo.MarkAsReadAsync(id);

        if (!updated)
            return new ApiResponse<object>(false, "Notification not found.", null);

        return new ApiResponse<object>(true, "Marked as read.", null);
    }

    public async Task<ApiResponse<object>> CreateMoneyRequestNotificationAsync(
        string requesterUserId,
        string requesterName,
        string requesterEmail,
        MoneyRequestNotificationRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.RecipientUserId))
            return new ApiResponse<object>(false, "Recipient user is required.", null);

        if (req.Amount <= 0)
            return new ApiResponse<object>(false, "Amount must be greater than 0.", null);

        if (string.Equals(requesterUserId, req.RecipientUserId, StringComparison.OrdinalIgnoreCase))
            return new ApiResponse<object>(false, "You cannot request money from yourself.", null);

        var note = string.IsNullOrWhiteSpace(req.Note) ? "No note provided." : req.Note.Trim();

        var title = "Money Request Received";
        var message =
            $"{requesterName} ({requesterEmail}) requested Rs. {req.Amount:0.00} from you. Note: {note}";

        // ✅ SAVE NOTIFICATION
        await _repo.SaveAsync(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = req.RecipientUserId,
            Title = title,
            Message = message,
            Type = "money_request",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        // ✅ SEND EMAIL (FIXED SIGNATURE)
        await _emailService.SendNotificationEmailAsync(
            req.RecipientUserId,
            null, // 🔥 email not passed here (OTP uses email directly)
            title,
            message,
            "money_request",
            req.Amount,
            null,
            note,
            requesterName,
            requesterEmail,
            null,
            DateTime.UtcNow
        );

        return new ApiResponse<object>(true, "Money request notification sent.", null);
    }
}
