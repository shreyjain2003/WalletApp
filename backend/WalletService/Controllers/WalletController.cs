using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WalletService.Common.Exceptions;
using WalletService.DTOs;
using WalletService.Services;

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
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAppException("Invalid or expired token.");

    [HttpGet]
    public async Task<IActionResult> GetWallet()
    {
        var result = await _wallet.GetOrCreateWalletAsync(CurrentUserId);
        return Ok(result);
    }

    [HttpPost("topup")]
    public async Task<IActionResult> TopUp([FromBody] TopUpRequest req)
    {
        var result = await _wallet.TopUpAsync(CurrentUserId, req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    [HttpPost("transfer")]
    public async Task<IActionResult> Transfer([FromBody] TransferRequest req)
    {
        var result = await _wallet.TransferAsync(CurrentUserId, req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

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
        if (file == null) throw new NotFoundAppException("Wallet history not found.");
        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpGet("history/export/pdf")]
    public async Task<IActionResult> ExportHistoryPdf()
    {
        var file = await _wallet.ExportHistoryPdfAsync(CurrentUserId);
        if (file == null) throw new NotFoundAppException("Wallet history not found.");
        return File(file.Content, file.ContentType, file.FileName);
    }

    [Authorize]
    [HttpGet("by-email")]
    public async Task<IActionResult> GetWalletByEmail([FromQuery] string email)
    {
        var result = await _wallet.GetWalletByEmailAsync(email);

        if (!result.Success) throw new NotFoundAppException(result.Message);

        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("admin/adjust")]
    public async Task<IActionResult> AdjustWallet([FromBody] AdjustWalletRequest req)
    {
        var result = await _wallet.AdjustWalletAsync(req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("admin/lock")]
    public async Task<IActionResult> LockWallet([FromBody] LockWalletRequest req)
    {
        var result = await _wallet.LockWalletAsync(req);
        if (!result.Success) throw new AppValidationException(result.Message);
        return Ok(result);
    }
}
