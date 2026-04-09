using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Security.Claims;
using WalletService.DTOs;
using WalletService.Services;
using static System.Net.Mime.MediaTypeNames;
using static System.Net.WebRequestMethods;

namespace WalletService.Controllers;

[ApiController]
[Route("api/wallet")]
[Authorize]
public class WalletController : ControllerBase
{
    private readonly IWalletService _wallet;

    public WalletController(IWalletService wallet)
    {
        _wallet = wallet;
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ── GET /api/wallet ───────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetWallet()
    {
        var result = await _wallet.GetOrCreateWalletAsync(CurrentUserId);
        return Ok(result);
    }

    // ── POST /api/wallet/topup ────────────────────────────────────────────
    [HttpPost("topup")]
    public async Task<IActionResult> TopUp([FromBody] TopUpRequest req)
    {
        var result = await _wallet.TopUpAsync(CurrentUserId, req);
        if (!result.Success)
            return BadRequest(result);
        return Ok(result);
    }

    // ── POST /api/wallet/transfer ─────────────────────────────────────────
    [HttpPost("transfer")]
    public async Task<IActionResult> Transfer([FromBody] TransferRequest req)
    {
        var result = await _wallet.TransferAsync(CurrentUserId, req);
        if (!result.Success)
            return BadRequest(result);
        return Ok(result);
    }

    // ── GET /api/wallet/history ───────────────────────────────────────────
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var result = await _wallet.GetHistoryAsync(CurrentUserId);
        return Ok(result);
    }

    [HttpGet("history/export/csv")]
    public async Task<IActionResult> ExportHistoryCsv()
    {
        var file = await _wallet.ExportHistoryCsvAsync(CurrentUserId);
        if (file == null) return NotFound();
        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpGet("history/export/pdf")]
    public async Task<IActionResult> ExportHistoryPdf()
    {
        var file = await _wallet.ExportHistoryPdfAsync(CurrentUserId);
        if (file == null) return NotFound();
        return File(file.Content, file.ContentType, file.FileName);
    }

    // ── GET /api/wallet/by-email ──────────────────────────────────────────
    [AllowAnonymous]
    [HttpGet("by-email")]
    public async Task<IActionResult> GetWalletByEmail([FromQuery] string email)
    {
        var result = await _wallet.GetWalletByEmailAsync(email);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
    // ── PUT /api/wallet/admin/adjust ─────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPut("admin/adjust")]
    public async Task<IActionResult> AdjustWallet([FromBody] AdjustWalletRequest req)
    {
        var result = await _wallet.AdjustWalletAsync(req);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    // ── PUT /api/wallet/admin/lock ────────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPut("admin/lock")]
    public async Task<IActionResult> LockWallet([FromBody] LockWalletRequest req)
    {
        var result = await _wallet.LockWalletAsync(req);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }
}
