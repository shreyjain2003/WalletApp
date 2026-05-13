// ============================================================
// WalletController.cs — WalletService
// ------------------------------------------------------------
// HTTP API for all wallet operations. Every route requires a valid
// JWT (enforced by [Authorize] at the class level).
//
// User routes (any authenticated user):
//   GET  /api/wallet                  — get or auto-create the user's wallet
//   POST /api/wallet/topup            — add funds to the wallet
//   POST /api/wallet/transfer         — send money to another user (requires PIN)
//   GET  /api/wallet/history          — paginated transaction history
//   GET  /api/wallet/history/export/csv — download full history as CSV
//   GET  /api/wallet/history/export/pdf — download full history as PDF
//   GET  /api/wallet/by-email         — look up another user's wallet by email
//                                       (used by Transfer page to validate receiver)
//
// Admin-only routes (require Role = "Admin"):
//   PUT  /api/wallet/admin/adjust     — manually set a user's wallet balance
//   PUT  /api/wallet/admin/lock       — lock or unlock a user's wallet
//
// All business logic lives in IWalletService — this controller is
// intentionally thin (validate → delegate → respond).
// ============================================================

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WalletService.Common.Exceptions;
using WalletService.DTOs;
using WalletService.Services;

namespace WalletService.Controllers;

// [Authorize] at the class level means every action requires a valid JWT.
// Individual actions can override this with [AllowAnonymous] or
// [Authorize(Roles = "Admin")] for stricter access control.
[ApiController]
[Route("api/wallet")]
[Authorize]
public class WalletController : ControllerBase
{
    // IWalletService contains all business logic — balance checks, KYC checks,
    // PIN verification, transaction recording, and RabbitMQ publishing.
    private readonly IWalletService _wallet;

    public WalletController(IWalletService wallet)
    {
        _wallet = wallet;
    }

    // Helper: extracts the authenticated user's GUID from the JWT claims.
    // ClaimTypes.NameIdentifier is set to user.Id.ToString() in TokenService.
    // Throws UnauthorizedAppException (→ HTTP 401) if the claim is missing.
    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    // ── GET /api/wallet ──────────────────────────────────────────────────────
    // Returns the current user's wallet. If no wallet exists yet (e.g. the user
    // just registered), one is created automatically with a zero balance.
    // The wallet is also auto-created by KycApprovalConsumer when KYC is approved,
    // but this endpoint handles the case where the consumer missed the event.
    [HttpGet]
    public async Task<IActionResult> GetWallet()
    {
        var result = await _wallet.GetOrCreateWalletAsync(CurrentUserId);
        return Ok(result);
    }

    // ── POST /api/wallet/topup ───────────────────────────────────────────────
    // Adds funds to the user's wallet (mock payment — no real payment gateway).
    // Validates that the user's KYC is approved before allowing top-up.
    // Records a "topup" transaction and publishes a notification event.
    [HttpPost("topup")]
    public async Task<IActionResult> TopUp([FromBody] TopUpRequest req)
    {
        var result = await _wallet.TopUpAsync(CurrentUserId, req);
        // Convert service-layer failures to HTTP 400 via the exception middleware.
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    // ── POST /api/wallet/transfer ────────────────────────────────────────────
    // Transfers money from the current user to another user identified by
    // ReceiverUserId. Requires a valid transaction PIN in the request body.
    // The transfer is wrapped in a database transaction — if anything fails,
    // both the debit and credit are rolled back atomically.
    [HttpPost("transfer")]
    public async Task<IActionResult> Transfer([FromBody] TransferRequest req)
    {
        var result = await _wallet.TransferAsync(CurrentUserId, req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    // ── GET /api/wallet/history ──────────────────────────────────────────────
    // Returns the user's transaction history (most recent first, up to 50 rows).
    // Used by the History page, Dashboard recent transactions, and Analytics charts.
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var result = await _wallet.GetHistoryAsync(CurrentUserId);
        return Ok(result);
    }

    // ── GET /api/wallet/history/export/csv ──────────────────────────────────
    // Generates and streams a CSV file containing ALL transactions (no row limit).
    // The file includes a summary header (account holder, balance, totals)
    // followed by a row per transaction.
    // Returns the file as a downloadable attachment via File().
    [HttpGet("history/export/csv")]
    public async Task<IActionResult> ExportHistoryCsv()
    {
        var file = await _wallet.ExportHistoryCsvAsync(CurrentUserId);
        if (file == null) throw new NotFoundAppException("Wallet history not found.");
        // File() sets Content-Disposition: attachment so the browser downloads it.
        return File(file.Content, file.ContentType, file.FileName);
    }

    // ── GET /api/wallet/history/export/pdf ──────────────────────────────────
    // Generates and streams a professionally formatted PDF statement.
    // Built from scratch using raw PDF syntax (no third-party PDF library).
    // Supports multi-page output for large transaction histories.
    [HttpGet("history/export/pdf")]
    public async Task<IActionResult> ExportHistoryPdf()
    {
        var file = await _wallet.ExportHistoryPdfAsync(CurrentUserId);
        if (file == null) throw new NotFoundAppException("Wallet history not found.");
        return File(file.Content, file.ContentType, file.FileName);
    }

    // ── GET /api/wallet/by-email ─────────────────────────────────────────────
    // Looks up another user's wallet by their email address.
    // Used by the Transfer page to validate that the receiver has an active wallet
    // before showing the amount input. Also used by the admin user list to display
    // wallet balances alongside user records.
    // Requires authentication (any logged-in user can look up wallets by email).
    [Authorize]
    [HttpGet("by-email")]
    public async Task<IActionResult> GetWalletByEmail([FromQuery] string email)
    {
        var result = await _wallet.GetWalletByEmailAsync(email);
        if (!result.Success) throw new NotFoundAppException(result.Message);
        return Ok(result);
    }

    // ── PUT /api/wallet/admin/adjust ─────────────────────────────────────────
    // Admin-only: manually sets a user's wallet balance to a specific value.
    // Records an "admin_adjustment" transaction showing the delta (new - old).
    // Used by the admin user management panel to correct balances.
    [Authorize(Roles = "Admin")]
    [HttpPut("admin/adjust")]
    public async Task<IActionResult> AdjustWallet([FromBody] AdjustWalletRequest req)
    {
        var result = await _wallet.AdjustWalletAsync(req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    // ── PUT /api/wallet/admin/lock ───────────────────────────────────────────
    // Admin-only: locks or unlocks a user's wallet.
    // A locked wallet cannot receive top-ups or transfers.
    // Used to freeze accounts suspected of fraud or policy violations.
    [Authorize(Roles = "Admin")]
    [HttpPut("admin/lock")]
    public async Task<IActionResult> LockWallet([FromBody] LockWalletRequest req)
    {
        var result = await _wallet.LockWalletAsync(req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }
}
