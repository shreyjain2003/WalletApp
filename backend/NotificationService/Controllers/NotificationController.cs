using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationService.Common.Exceptions;
using NotificationService.DTOs;
using NotificationService.Services;
using System.Security.Claims;

namespace NotificationService.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationController : ControllerBase
{
    private readonly INotificationService _notifications;
    private readonly IConfiguration _config;

    public NotificationController(INotificationService notifications, IConfiguration config)
    {
        _notifications = notifications;
        _config = config;
    }

    private string CurrentUserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAppException("Invalid or expired token.");

    private string CurrentUserName =>
        User.FindFirstValue(ClaimTypes.Name) ?? "Trunqo User";

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? "unknown@trunqo.local";

    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        var result = await _notifications.GetUserNotificationsAsync(CurrentUserId);
        return Ok(result);
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var result = await _notifications.MarkAsReadAsync(id);

        if (!result.Success)
            throw new NotFoundAppException(result.Message);

        return Ok(result);
    }

    [HttpPost("request-money")]
    public async Task<IActionResult> SendMoneyRequestNotification([FromBody] MoneyRequestNotificationRequest req)
    {
        var result = await _notifications.CreateMoneyRequestNotificationAsync(
            CurrentUserId, CurrentUserName, CurrentUserEmail, req);

        if (!result.Success)
            throw new AppValidationException(result.Message);

        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("internal/create")]
    public async Task<IActionResult> CreateInternal([FromBody] InternalNotificationRequest req)
    {
        var expectedKey = _config["InternalApiKey"] ?? "TrunqoInternalKey2024";
        if (!Request.Headers.TryGetValue("X-Internal-Api-Key", out var provided)
            || !string.Equals(provided.ToString(), expectedKey, StringComparison.Ordinal))
        {
            throw new UnauthorizedAppException("Unauthorized internal request.");
        }

        var result = await _notifications.CreateInternalNotificationAsync(req);
        if (!result.Success)
            throw new AppValidationException(result.Message);

        return Ok(result);
    }
}
