// CampaignController.cs
// Exposes HTTP endpoints for managing and browsing promotional campaigns.
// Admin users can create campaigns and attach rules; regular users can browse
// active campaigns and view their own redemption history.
// An internal endpoint allows other microservices to trigger campaign evaluation
// after a financial transaction completes.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RewardService.Common.Exceptions;
using RewardService.DTOs;
using RewardService.Services;
using System.Security.Claims;

namespace RewardService.Controllers;

// All routes are prefixed with /api/rewards/campaigns.
// [Authorize] requires a valid JWT for every endpoint unless overridden.
[ApiController]
[Route("api/rewards/campaigns")]
[Authorize]
public class CampaignController : ControllerBase
{
    // Service containing all campaign business logic (creation, rule evaluation, redemptions).
    private readonly ICampaignService _campaignService;

    // Configuration is injected to read the internal API key for service-to-service calls.
    private readonly IConfiguration _config;

    // Constructor injection — ASP.NET DI container provides both dependencies at runtime.
    public CampaignController(ICampaignService campaignService, IConfiguration config)
    {
        _campaignService = campaignService;
        _config = config;
    }

    // Extracts the authenticated user's ID from the JWT NameIdentifier claim.
    // Throws UnauthorizedAppException if the claim is missing or malformed,
    // which the global exception middleware converts to a 401 response.
    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    // GET /api/rewards/campaigns
    // Admin-only: returns all campaigns (active and inactive) with their rules,
    // so admins can manage the full campaign catalogue.
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetCampaigns()
    {
        var result = await _campaignService.GetAllCampaignsAsync();
        return Ok(result);
    }

    // GET /api/rewards/campaigns/available
    // Public (authenticated) endpoint that returns only currently active, non-expired campaigns.
    // Used by the frontend to show users which promotions they can benefit from right now.
    [HttpGet("available")]
    public async Task<IActionResult> GetAvailableCampaigns()
    {
        var result = await _campaignService.GetAvailableCampaignsAsync();
        return Ok(result);
    }

    // POST /api/rewards/campaigns
    // Admin-only: creates a new campaign with the provided metadata.
    // Rules are added separately via the /rules endpoint so campaigns can be
    // created first and rules attached incrementally.
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateCampaign([FromBody] CreateCampaignRequest request)
    {
        var result = await _campaignService.CreateCampaignAsync(request);

        // Surface validation failures (e.g. missing name, invalid date range) as 400.
        if (!result.Success)
            throw new AppValidationException(result.Message);

        return Ok(result);
    }

    // POST /api/rewards/campaigns/{campaignId}/rules
    // Admin-only: attaches a new eligibility rule to an existing campaign.
    // A campaign can have multiple rules for different transaction types or amount bands.
    [HttpPost("{campaignId:guid}/rules")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddRule(Guid campaignId, [FromBody] AddCampaignRuleRequest request)
    {
        var result = await _campaignService.AddRuleAsync(campaignId, request);

        // Surface validation failures (e.g. campaign not found, invalid reward type) as 400.
        if (!result.Success)
            throw new AppValidationException(result.Message);

        return Ok(result);
    }

    // GET /api/rewards/campaigns/my-redemptions
    // Returns the authenticated user's campaign redemption history so they can see
    // which promotions have been applied to their past transactions.
    [HttpGet("my-redemptions")]
    public async Task<IActionResult> MyRedemptions()
    {
        var result = await _campaignService.GetMyRedemptionsAsync(CurrentUserId);
        return Ok(result);
    }

    // POST /api/rewards/campaigns/internal/evaluate
    // Internal-only endpoint called by other microservices (e.g. WalletService) after a
    // financial transaction completes, to check whether any active campaign rules apply
    // and credit the appropriate reward or cashback.
    // [AllowAnonymous] bypasses JWT; the X-Internal-Api-Key header is the shared secret.
    [HttpPost("internal/evaluate")]
    [AllowAnonymous]
    public async Task<IActionResult> Evaluate([FromBody] EvaluateCampaignsRequest request)
    {
        // Read the expected internal key from config (falls back to a default for local dev).
        var expectedKey = _config["InternalApiKey"] ?? "TrunqoInternalKey2024";

        // Reject the request if the header is absent or the key doesn't match,
        // preventing external actors from triggering campaign evaluation arbitrarily.
        if (!Request.Headers.TryGetValue("X-Internal-Api-Key", out var providedKey)
            || providedKey != expectedKey)
            throw new UnauthorizedAppException("Unauthorized internal request.");

        // Run the campaign evaluation engine for this user + transaction combination.
        var result = await _campaignService.EvaluateAndApplyAsync(
            request.UserId,
            request.TransactionType,
            request.TransactionAmount,
            request.TransactionRef);

        // Surface validation failures (e.g. invalid transaction type) as 400.
        if (!result.Success)
            throw new AppValidationException(result.Message);

        return Ok(result);
    }
}
