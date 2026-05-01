using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RewardService.Common.Exceptions;
using RewardService.DTOs;
using RewardService.Services;
using System.Security.Claims;

namespace RewardService.Controllers;

[ApiController]
[Route("api/rewards/campaigns")]
[Authorize]
public class CampaignController : ControllerBase
{
    private readonly ICampaignService _campaignService;
    private readonly IConfiguration _config;

    public CampaignController(ICampaignService campaignService, IConfiguration config)
    {
        _campaignService = campaignService;
        _config = config;
    }

    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetCampaigns()
    {
        var result = await _campaignService.GetAllCampaignsAsync();
        return Ok(result);
    }

    // Available active campaigns for regular users to browse
    [HttpGet("available")]
    public async Task<IActionResult> GetAvailableCampaigns()
    {
        var result = await _campaignService.GetAvailableCampaignsAsync();
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateCampaign([FromBody] CreateCampaignRequest request)
    {
        var result = await _campaignService.CreateCampaignAsync(request);
        if (!result.Success)
            throw new AppValidationException(result.Message);
        return Ok(result);
    }

    [HttpPost("{campaignId:guid}/rules")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddRule(Guid campaignId, [FromBody] AddCampaignRuleRequest request)
    {
        var result = await _campaignService.AddRuleAsync(campaignId, request);
        if (!result.Success)
            throw new AppValidationException(result.Message);
        return Ok(result);
    }

    [HttpGet("my-redemptions")]
    public async Task<IActionResult> MyRedemptions()
    {
        var result = await _campaignService.GetMyRedemptionsAsync(CurrentUserId);
        return Ok(result);
    }

    [HttpPost("internal/evaluate")]
    [AllowAnonymous]
    public async Task<IActionResult> Evaluate([FromBody] EvaluateCampaignsRequest request)
    {
        var expectedKey = _config["InternalApiKey"] ?? "TrunqoInternalKey";
        if (!Request.Headers.TryGetValue("X-Internal-Api-Key", out var providedKey)
            || providedKey != expectedKey)
            throw new UnauthorizedAppException("Unauthorized internal request.");

        var result = await _campaignService.EvaluateAndApplyAsync(
            request.UserId,
            request.TransactionType,
            request.TransactionAmount,
            request.TransactionRef);

        if (!result.Success)
            throw new AppValidationException(result.Message);

        return Ok(result);
    }
}
