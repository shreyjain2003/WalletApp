using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    public NotificationController(INotificationService notifications)
    {
        _notifications = notifications;
    }

    private string CurrentUserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private string CurrentUserName =>
        User.FindFirstValue(ClaimTypes.Name) ?? "WalletApp User";

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? "unknown@walletapp.local";

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
            return NotFound(result);

        return Ok(result);
    }

    [HttpPost("request-money")]
    public async Task<IActionResult> SendMoneyRequestNotification([FromBody] MoneyRequestNotificationRequest req)
    {
        var result = await _notifications.CreateMoneyRequestNotificationAsync(
            CurrentUserId, CurrentUserName, CurrentUserEmail, req);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
