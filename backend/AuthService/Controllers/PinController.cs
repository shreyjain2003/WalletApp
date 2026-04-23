using AuthService.Common.Exceptions;
using AuthService.DTOs;
using AuthService.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AuthService.Controllers;

[ApiController]
[Route("api/auth/pin")]
[Authorize]
public class PinController : ControllerBase
{
    private readonly ITransactionPinRepository _pins;

    public PinController(ITransactionPinRepository pins)
    {
        _pins = pins;
    }

    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    [HttpGet("status")]
    public async Task<IActionResult> GetPinStatus()
    {
        var hasPin = await _pins.HasPinAsync(CurrentUserId);
        return Ok(new ApiResponse<PinStatusResponse>(true, "OK", new PinStatusResponse(hasPin)));
    }

    [HttpPost("set")]
    public async Task<IActionResult> SetPin([FromBody] SetPinRequest req)
    {
        if (req.NewPin != req.ConfirmPin)
            throw new AppValidationException("PINs do not match.");

        if (req.NewPin.Length < 4 || req.NewPin.Length > 8 || !req.NewPin.All(char.IsDigit))
            throw new AppValidationException("PIN must be 4-8 digits.");

        var hasPin = await _pins.HasPinAsync(CurrentUserId);

        if (hasPin)
        {
            if (string.IsNullOrWhiteSpace(req.CurrentPin))
                throw new AppValidationException("Current PIN is required to change your PIN.");

            var valid = await _pins.VerifyPinAsync(CurrentUserId, req.CurrentPin);
            if (!valid)
                throw new AppValidationException("Current PIN is incorrect.");
        }

        await _pins.SetPinAsync(CurrentUserId, req.NewPin);
        return Ok(new ApiResponse<object>(true, "PIN set successfully.", null));
    }

    [HttpPost("remove")]
    public async Task<IActionResult> RemovePin([FromBody] RemovePinRequest req)
    {
        var valid = await _pins.VerifyPinAsync(CurrentUserId, req.CurrentPin);
        if (!valid)
            throw new AppValidationException("Incorrect PIN.");

        await _pins.RemovePinAsync(CurrentUserId);
        return Ok(new ApiResponse<object>(true, "PIN removed.", null));
    }

    // Internal endpoint called by WalletService to verify PIN before transfer
    // Route: POST /api/auth/internal/user/{userId}/pin/verify
    [AllowAnonymous]
    [HttpPost("/api/auth/internal/user/{userId}/pin/verify")]
    public async Task<IActionResult> VerifyPinInternal(Guid userId, [FromBody] VerifyPinRequest req)
    {
        var config = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expectedKey = config["InternalApiKey"] ?? "TrunqoInternalKey";
        if (!Request.Headers.TryGetValue("X-Internal-Api-Key", out var key) || key != expectedKey)
            return Unauthorized(new { success = false, message = "Unauthorized." });

        if (string.IsNullOrWhiteSpace(req.Pin))
            return BadRequest(new ApiResponse<object>(false, "PIN is required.", null));

        var hasPin = await _pins.HasPinAsync(userId);
        if (!hasPin)
            return BadRequest(new ApiResponse<object>(false, "No transaction PIN set. Please set a PIN first.", null));

        var valid = await _pins.VerifyPinAsync(userId, req.Pin);
        if (!valid)
            return BadRequest(new ApiResponse<object>(false, "Incorrect transaction PIN.", null));

        return Ok(new ApiResponse<object>(true, "PIN verified.", null));
    }
}
