// RewardController.cs
// Handles HTTP endpoints for the reward points system.
// Authenticated users can view their reward balance and transaction history.
// An internal endpoint (protected by a shared API key) allows other microservices
// to credit points without going through the public JWT-authenticated surface.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RewardService.Common.Exceptions;
using RewardService.Services;
using System.Security.Claims;

namespace RewardService.Controllers;

// All routes in this controller are prefixed with /api/rewards.
// [Authorize] ensures every endpoint requires a valid JWT unless explicitly overridden.
[ApiController]
[Route("api/rewards")]
[Authorize]
public class RewardController : ControllerBase
{
    // Service that contains all reward business logic (balance, points, tiers).
    private readonly IRewardService _reward;

    // Configuration is injected to read the internal API key for service-to-service calls.
    private readonly IConfiguration _config;

    // Constructor injection — ASP.NET DI container provides both dependencies at runtime.
    public RewardController(IRewardService reward, IConfiguration config)
    {
        _reward = reward;
        _config = config;
    }

    // Extracts the authenticated user's ID from the JWT NameIdentifier claim.
    // Throws UnauthorizedAppException if the claim is missing or malformed,
    // which the global exception middleware converts to a 401 response.
    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    // GET /api/rewards
    // Returns the caller's current reward balance, tier, and metadata.
    // If the user has never earned points before, a new reward record is created on the fly
    // so the frontend always gets a valid response rather than a 404.
    [HttpGet]
    public async Task<IActionResult> GetRewards()
    {
        var result = await _reward.GetOrCreateRewardAsync(CurrentUserId);
        return Ok(result);
    }

    // GET /api/rewards/history
    // Returns the last 50 point-earning transactions for the authenticated user,
    // ordered newest-first, so users can audit how they accumulated points.
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var result = await _reward.GetHistoryAsync(CurrentUserId);
        return Ok(result);
    }

    // POST /api/rewards/internal/add-points
    // Internal-only endpoint that lets other microservices (e.g. WalletService after a transfer)
    // credit reward points to a user without needing a user JWT.
    // [AllowAnonymous] bypasses JWT middleware; the X-Internal-Api-Key header acts as the
    // shared secret so only trusted backend services can call this.
    [AllowAnonymous]
    [HttpPost("internal/add-points")]
    public async Task<IActionResult> AddPoints([FromBody] AddPointsRequest req)
    {
        // Read the expected internal key from config (falls back to a default for local dev).
        var expectedKey = _config["InternalApiKey"] ?? "TrunqoInternalKey2024";

        // Reject the request immediately if the header is absent or the key doesn't match.
        // This prevents external callers from arbitrarily inflating user point balances.
        if (!Request.Headers.TryGetValue("X-Internal-Api-Key", out var key) || key != expectedKey)
            throw new UnauthorizedAppException("Unauthorized internal request.");

        // Delegate to the service layer which handles idempotency and tier recalculation.
        var result = await _reward.AddPointsAsync(
            req.UserId, req.Points, req.Reason, req.Reference);

        // If the service returns a failure (e.g. duplicate reference), surface it as a 400.
        if (!result.Success)
            throw new AppValidationException(result.Message);

        return Ok(result);
    }
}

// Request body model for the internal add-points endpoint.
// Reference is used for idempotency — the same transaction reference should not earn points twice.
public record AddPointsRequest(
    Guid UserId,
    int Points,
    string Reason,
    string Reference
);
