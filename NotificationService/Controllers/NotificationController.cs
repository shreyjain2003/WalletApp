using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    // ── GET /api/notifications ────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        var result = await _notifications.GetUserNotificationsAsync(CurrentUserId);
        return Ok(result);
    }

    // ── PUT /api/notifications/{id}/read ──────────────────────────────────
    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var result = await _notifications.MarkAsReadAsync(id);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}