// ============================================================
// PinController.cs — AuthService
// ------------------------------------------------------------
// Manages the 4–8 digit transaction PIN that users must enter
// before every money transfer. The PIN is BCrypt-hashed before
// storage — it is never stored in plain text.
//
// Public routes (require JWT):
//   GET  /api/auth/pin/status  — check whether the user has a PIN set
//   POST /api/auth/pin/set     — create or change the PIN
//   POST /api/auth/pin/remove  — delete the PIN (requires current PIN)
//
// Internal route (requires X-Internal-Api-Key header):
//   POST /api/auth/internal/user/{userId}/pin/verify
//       — called by WalletService before processing a transfer
// ============================================================

using AuthService.Common.Exceptions;
using AuthService.DTOs;
using AuthService.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AuthService.Controllers;

// All routes under this controller require a valid JWT by default.
// The internal verify endpoint overrides this with [AllowAnonymous]
// and enforces its own API-key check instead.
[ApiController]
[Route("api/auth/pin")]
[Authorize]
public class PinController : ControllerBase
{
    // ITransactionPinRepository abstracts all SQL operations for the
    // TransactionPins table (HasPin, VerifyPin, SetPin, RemovePin).
    private readonly ITransactionPinRepository _pins;

    public PinController(ITransactionPinRepository pins)
    {
        _pins = pins;
    }

    // Helper: extracts the authenticated user's ID from the JWT claims.
    // Throws UnauthorizedAppException (→ HTTP 401) if the claim is missing
    // or cannot be parsed as a GUID — this should never happen with a valid token.
    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    // ── GET /api/auth/pin/status ─────────────────────────────────────────────
    // Returns { hasPin: true/false } so the frontend can show the correct UI:
    //   - "Set PIN" button if no PIN exists
    //   - "Change PIN" flow if a PIN already exists
    //   - Warning banner on the Transfer page if no PIN is set
    [HttpGet("status")]
    public async Task<IActionResult> GetPinStatus()
    {
        var hasPin = await _pins.HasPinAsync(CurrentUserId);
        return Ok(new ApiResponse<PinStatusResponse>(true, "OK", new PinStatusResponse(hasPin)));
    }

    // ── POST /api/auth/pin/set ───────────────────────────────────────────────
    // Creates a new PIN or changes an existing one.
    // Rules:
    //   - PIN must be 4–8 digits (numeric only).
    //   - NewPin and ConfirmPin must match.
    //   - If a PIN already exists, the user must supply the correct CurrentPin
    //     to prove they know the old one before changing it.
    // The PIN is BCrypt-hashed before being stored — same algorithm as passwords.
    [HttpPost("set")]
    public async Task<IActionResult> SetPin([FromBody] SetPinRequest req)
    {
        // Confirm the two new-PIN fields match before doing anything else.
        if (req.NewPin != req.ConfirmPin)
            throw new AppValidationException("PINs do not match.");

        // Enforce PIN format: 4–8 numeric digits only.
        if (req.NewPin.Length < 4 || req.NewPin.Length > 8 || !req.NewPin.All(char.IsDigit))
            throw new AppValidationException("PIN must be 4-8 digits.");

        var hasPin = await _pins.HasPinAsync(CurrentUserId);

        if (hasPin)
        {
            // Changing an existing PIN requires the current PIN for verification.
            if (string.IsNullOrWhiteSpace(req.CurrentPin))
                throw new AppValidationException("Current PIN is required to change your PIN.");

            // BCrypt.Verify compares the submitted PIN against the stored hash.
            var valid = await _pins.VerifyPinAsync(CurrentUserId, req.CurrentPin);
            if (!valid)
                throw new AppValidationException("Current PIN is incorrect.");
        }

        // Hash and persist the new PIN.
        await _pins.SetPinAsync(CurrentUserId, req.NewPin);
        return Ok(new ApiResponse<object>(true, "PIN set successfully.", null));
    }

    // ── POST /api/auth/pin/remove ────────────────────────────────────────────
    // Deletes the user's transaction PIN entirely.
    // Requires the current PIN to prevent unauthorized removal.
    // After removal, transfers will show a warning that no PIN is set.
    [HttpPost("remove")]
    public async Task<IActionResult> RemovePin([FromBody] RemovePinRequest req)
    {
        // Verify the current PIN before allowing removal.
        var valid = await _pins.VerifyPinAsync(CurrentUserId, req.CurrentPin);
        if (!valid)
            throw new AppValidationException("Incorrect PIN.");

        await _pins.RemovePinAsync(CurrentUserId);
        return Ok(new ApiResponse<object>(true, "PIN removed.", null));
    }

    // ── POST /api/auth/internal/user/{userId}/pin/verify ────────────────────
    // Internal endpoint called by WalletService during the transfer flow.
    // WalletService cannot use a user JWT here because it is a server-to-server
    // call, so authentication is done via the shared X-Internal-Api-Key header.
    //
    // Flow:
    //   1. WalletService receives a transfer request with a transactionPin field.
    //   2. WalletService calls this endpoint with the userId and PIN.
    //   3. This endpoint verifies the PIN hash and returns success/failure.
    //   4. WalletService only proceeds with the transfer if verification succeeds.
    //
    // [AllowAnonymous] bypasses the JWT [Authorize] on the class level.
    // The API key check below replaces JWT authentication for this route.
    [AllowAnonymous]
    [HttpPost("/api/auth/internal/user/{userId}/pin/verify")]
    public async Task<IActionResult> VerifyPinInternal(Guid userId, [FromBody] VerifyPinRequest req)
    {
        // Resolve the expected internal API key from configuration.
        var config = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expectedKey = config["InternalApiKey"] ?? "TrunqoInternalKey2024";

        // Reject the request if the header is missing or the key does not match.
        if (!Request.Headers.TryGetValue("X-Internal-Api-Key", out var key) || key != expectedKey)
            return Unauthorized(new { success = false, message = "Unauthorized." });

        // A PIN value must be provided in the request body.
        if (string.IsNullOrWhiteSpace(req.Pin))
            return BadRequest(new ApiResponse<object>(false, "PIN is required.", null));

        // If the user has never set a PIN, block the transfer with a clear message.
        var hasPin = await _pins.HasPinAsync(userId);
        if (!hasPin)
            return BadRequest(new ApiResponse<object>(false, "No transaction PIN set. Please set a PIN first.", null));

        // BCrypt-verify the submitted PIN against the stored hash.
        var valid = await _pins.VerifyPinAsync(userId, req.Pin);
        if (!valid)
            return BadRequest(new ApiResponse<object>(false, "Incorrect transaction PIN.", null));

        return Ok(new ApiResponse<object>(true, "PIN verified.", null));
    }
}
