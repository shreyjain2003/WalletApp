using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RewardService.Common.Exceptions;
using RewardService.Services;
using System.Security.Claims;

namespace RewardService.Controllers;

[ApiController]
[Route("api/rewards")]
[Authorize]
public class RewardController : ControllerBase
{
    private readonly IRewardService _reward;
    private readonly IConfiguration _config;

    public RewardController(IRewardService reward, IConfiguration config)
    {
        _reward = reward;
        _config = config;
    }

    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    [HttpGet]
    public async Task<IActionResult> GetRewards()
    {
        var result = await _reward.GetOrCreateRewardAsync(CurrentUserId);
        return Ok(result);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var result = await _reward.GetHistoryAsync(CurrentUserId);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("internal/add-points")]
    public async Task<IActionResult> AddPoints([FromBody] AddPointsRequest req)
    {
        var expectedKey = _config["InternalApiKey"] ?? "TrunqoInternalKey";
        if (!Request.Headers.TryGetValue("X-Internal-Api-Key", out var key) || key != expectedKey)
            throw new UnauthorizedAppException("Unauthorized internal request.");

        var result = await _reward.AddPointsAsync(
            req.UserId, req.Points, req.Reason, req.Reference);

        if (!result.Success)
            throw new AppValidationException(result.Message);

        return Ok(result);
    }
}

public record AddPointsRequest(
    Guid UserId,
    int Points,
    string Reason,
    string Reference
);
