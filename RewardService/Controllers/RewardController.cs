using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using RewardService.DTOs;
using RewardService.Services;

namespace RewardService.Controllers;

[ApiController]
[Route("api/rewards")]
[Authorize]
public class RewardController : ControllerBase
{
    private readonly IRewardService _reward;

    public RewardController(IRewardService reward)
    {
        _reward = reward;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── GET /api/rewards ──────────────────────────────────────────────────
    // Get current user's reward account — creates one if doesn't exist
    [HttpGet]
    public async Task<IActionResult> GetRewards()
    {
        var result = await _reward.GetOrCreateRewardAsync(CurrentUserId);
        return Ok(result);
    }

    // ── GET /api/rewards/history ──────────────────────────────────────────
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var result = await _reward.GetHistoryAsync(CurrentUserId);
        return Ok(result);
    }

    // ── POST /api/rewards/internal/add-points ─────────────────────────────
    // Internal endpoint — called by RabbitMQ consumer when transfer happens
    [AllowAnonymous]
    [HttpPost("internal/add-points")]
    public async Task<IActionResult> AddPoints([FromBody] AddPointsRequest req)
    {
        var result = await _reward.AddPointsAsync(
            req.UserId, req.Points, req.Reason, req.Reference);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}

// Internal request model
public record AddPointsRequest(
    Guid UserId,
    int Points,
    string Reason,
    string Reference
);