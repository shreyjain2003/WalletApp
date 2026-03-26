using Microsoft.EntityFrameworkCore;
using WalletService.Data;
using WalletService.DTOs;
using WalletService.Models;

namespace WalletService.Services;

public interface IWalletService
{
    Task<ApiResponse<WalletResponse>> GetOrCreateWalletAsync(Guid userId);
    Task<ApiResponse<WalletResponse>> TopUpAsync(Guid userId, TopUpRequest req);
    Task<ApiResponse<WalletResponse>> TransferAsync(Guid userId, TransferRequest req);
    Task<ApiResponse<List<TransactionResponse>>> GetHistoryAsync(Guid userId);
    Task<ApiResponse<WalletResponse>> GetWalletByEmailAsync(string email);
    Task<ApiResponse<WalletResponse>> AdjustWalletAsync(AdjustWalletRequest req);
    Task<ApiResponse<WalletResponse>> LockWalletAsync(LockWalletRequest req);
}

public class WalletService : IWalletService
{
    private readonly WalletDbContext _db;
    private readonly IRabbitMqPublisher _mq;
    private readonly IConfiguration _config;

    public WalletService(WalletDbContext db, IRabbitMqPublisher mq,
                         IConfiguration config)
    {
        _db = db;
        _mq = mq;
        _config = config;
    }

    // ── GET WALLET BY EMAIL ───────────────────────────────────────────────
    public async Task<ApiResponse<WalletResponse>> GetWalletByEmailAsync(string email)
    {
        using var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        using var http = new HttpClient(handler);
        http.BaseAddress = new Uri(_config["AuthService:BaseUrl"]!);

        var response = await http.GetAsync(
            $"/api/auth/internal/user-by-email?email={email}");

        if (!response.IsSuccessStatusCode)
            return new ApiResponse<WalletResponse>(false, "User not found.", null);

        var json = await response.Content.ReadAsStringAsync();
        var data = System.Text.Json.JsonSerializer.Deserialize<AuthUserResponse>(
            json, new System.Text.Json.JsonSerializerOptions
            { PropertyNameCaseInsensitive = true });

        if (data?.Data == null)
            return new ApiResponse<WalletResponse>(false, "User not found.", null);

        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.UserId == data.Data.UserId);

        if (wallet == null)
            return new ApiResponse<WalletResponse>(false, "Receiver wallet not found.", null);

        return new ApiResponse<WalletResponse>(true, "OK", MapWallet(wallet));
    }

    // ── GET OR CREATE WALLET ──────────────────────────────────────────────
    public async Task<ApiResponse<WalletResponse>> GetOrCreateWalletAsync(Guid userId)
    {
        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.UserId == userId);

        if (wallet == null)
        {
            wallet = new Wallet
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Balance = 0,
                Currency = "INR",
                IsLocked = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _db.Wallets.Add(wallet);
            await _db.SaveChangesAsync();
        }

        return new ApiResponse<WalletResponse>(true, "OK", MapWallet(wallet));
    }

    // ── TOP UP ────────────────────────────────────────────────────────────
    public async Task<ApiResponse<WalletResponse>> TopUpAsync(Guid userId, TopUpRequest req)
    {
        if (req.Amount <= 0)
            return new ApiResponse<WalletResponse>(false, "Amount must be greater than 0.", null);

        // ── KYC CHECK ─────────────────────────────────────────────────────
        var userStatus = await GetUserStatusAsync(userId);
        if (userStatus != "Active")
            return new ApiResponse<WalletResponse>(
                false,
                "Your KYC is not approved yet. Please complete KYC verification to use wallet services.",
                null);

        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.UserId == userId);

        if (wallet == null)
            return new ApiResponse<WalletResponse>(false, "Wallet not found.", null);

        if (wallet.IsLocked)
            return new ApiResponse<WalletResponse>(false, "Wallet is locked.", null);

        wallet.Balance += req.Amount;
        wallet.UpdatedAt = DateTime.UtcNow;

        var tx = new WalletTransaction
        {
            Id = Guid.NewGuid(),
            WalletId = wallet.Id,
            ToWalletId = null,
            Type = "topup",
            Amount = req.Amount,
            BalanceAfter = wallet.Balance,
            Status = "Success",
            Reference = GenerateReference("TP"),
            Note = req.Note,
            CreatedAt = DateTime.UtcNow
        };

        _db.WalletTransactions.Add(tx);
        await _db.SaveChangesAsync();

        _mq.Publish("wallet_topup", new
        {
            UserId = userId.ToString(),
            Amount = req.Amount,
            Reference = tx.Reference
        });

        _mq.Publish("notifications", new
        {
            UserId = userId.ToString(),
            Title = "Top-up Successful",
            Message = $"₹{req.Amount} added to your wallet. New balance: ₹{wallet.Balance}",
            Type = "topup"
        });

        return new ApiResponse<WalletResponse>(true, "Top-up successful.", MapWallet(wallet));
    }

    // ── TRANSFER ──────────────────────────────────────────────────────────
    public async Task<ApiResponse<WalletResponse>> TransferAsync(Guid userId, TransferRequest req)
    {
        if (req.Amount <= 0)
            return new ApiResponse<WalletResponse>(false, "Amount must be greater than 0.", null);

        if (req.ReceiverUserId == userId)
            return new ApiResponse<WalletResponse>(false, "Cannot transfer to yourself.", null);

        // ── KYC CHECK ─────────────────────────────────────────────────────
        var userStatus = await GetUserStatusAsync(userId);
        if (userStatus != "Active")
            return new ApiResponse<WalletResponse>(
                false,
                "Your KYC is not approved yet. Please complete KYC verification to use wallet services.",
                null);

        var senderWallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.UserId == userId);

        if (senderWallet == null)
            return new ApiResponse<WalletResponse>(false, "Your wallet not found.", null);

        if (senderWallet.IsLocked)
            return new ApiResponse<WalletResponse>(false, "Your wallet is locked.", null);

        if (senderWallet.Balance < req.Amount)
            return new ApiResponse<WalletResponse>(false, "Insufficient balance.", null);

        var receiverWallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.UserId == req.ReceiverUserId);

        if (receiverWallet == null)
            return new ApiResponse<WalletResponse>(false, "Receiver wallet not found.", null);

        if (receiverWallet.IsLocked)
            return new ApiResponse<WalletResponse>(false, "Receiver wallet is locked.", null);

        var reference = GenerateReference("TF");

        senderWallet.Balance -= req.Amount;
        senderWallet.UpdatedAt = DateTime.UtcNow;

        receiverWallet.Balance += req.Amount;
        receiverWallet.UpdatedAt = DateTime.UtcNow;

        var senderTx = new WalletTransaction
        {
            Id = Guid.NewGuid(),
            WalletId = senderWallet.Id,
            ToWalletId = receiverWallet.Id,
            Type = "transfer_out",
            Amount = req.Amount,
            BalanceAfter = senderWallet.Balance,
            Status = "Success",
            Reference = reference + "-OUT",
            Note = req.Note,
            CreatedAt = DateTime.UtcNow
        };

        var receiverTx = new WalletTransaction
        {
            Id = Guid.NewGuid(),
            WalletId = receiverWallet.Id,
            ToWalletId = senderWallet.Id,
            Type = "transfer_in",
            Amount = req.Amount,
            BalanceAfter = receiverWallet.Balance,
            Status = "Success",
            Reference = reference + "-IN",
            Note = req.Note,
            CreatedAt = DateTime.UtcNow
        };

        _db.WalletTransactions.AddRange(senderTx, receiverTx);
        await _db.SaveChangesAsync();

        _mq.Publish("wallet_transfer", new
        {
            SenderUserId = userId.ToString(),
            ReceiverUserId = req.ReceiverUserId.ToString(),
            Amount = req.Amount,
            Reference = reference
        });

        _mq.Publish("notifications", new
        {
            UserId = userId.ToString(),
            Title = "Transfer Successful",
            Message = $"₹{req.Amount} sent. New balance: ₹{senderWallet.Balance}",
            Type = "transfer_out"
        });

        _mq.Publish("notifications", new
        {
            UserId = req.ReceiverUserId.ToString(),
            Title = "Money Received",
            Message = $"₹{req.Amount} received. New balance: ₹{receiverWallet.Balance}",
            Type = "transfer_in"
        });

        return new ApiResponse<WalletResponse>(true, "Transfer successful.", MapWallet(senderWallet));
    }

    // ── GET HISTORY ───────────────────────────────────────────────────────
    public async Task<ApiResponse<List<TransactionResponse>>> GetHistoryAsync(Guid userId)
    {
        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.UserId == userId);

        if (wallet == null)
            return new ApiResponse<List<TransactionResponse>>(false, "Wallet not found.", null);

        var transactions = await _db.WalletTransactions
            .Where(t => t.WalletId == wallet.Id)
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .ToListAsync();

        var result = transactions.Select(t => new TransactionResponse(
            t.Id, t.Type, t.Amount, t.BalanceAfter,
            t.Status, t.Reference, t.Note, t.CreatedAt
        )).ToList();

        return new ApiResponse<List<TransactionResponse>>(true, "OK", result);
    }

    // ── CHECK USER STATUS ─────────────────────────────────────────────────
    private async Task<string> GetUserStatusAsync(Guid userId)
    {
        try
        {
            using var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback =
                    HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
            };
            using var http = new HttpClient(handler);
            http.BaseAddress = new Uri(_config["AuthService:BaseUrl"]!);

            var response = await http.GetAsync($"/api/auth/internal/user/{userId}");
            if (!response.IsSuccessStatusCode) return "Unknown";

            var json = await response.Content.ReadAsStringAsync();
            var data = System.Text.Json.JsonSerializer.Deserialize<AuthUserResponse>(
                json, new System.Text.Json.JsonSerializerOptions
                { PropertyNameCaseInsensitive = true });

            return data?.Data?.Status ?? "Unknown";
        }
        catch
        {
            return "Unknown";
        }
    }

    // ── HELPERS ───────────────────────────────────────────────────────────
    private static string GenerateReference(string prefix)
    {
        return $"{prefix}{DateTime.UtcNow:yyyyMMddHHmmss}{Guid.NewGuid().ToString("N")[..12].ToUpper()}";
    }

    private static WalletResponse MapWallet(Wallet w) =>
        new(w.Id, w.UserId, w.Balance, w.Currency, w.IsLocked, w.CreatedAt);
    // ── ADJUST WALLET BALANCE ─────────────────────────────────────────────
    public async Task<ApiResponse<WalletResponse>> AdjustWalletAsync(AdjustWalletRequest req)
    {
        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.UserId == req.UserId);

        if (wallet == null)
            return new ApiResponse<WalletResponse>(false, "Wallet not found.", null);

        wallet.Balance = req.NewBalance;
        wallet.UpdatedAt = DateTime.UtcNow;

        var tx = new WalletTransaction
        {
            Id = Guid.NewGuid(),
            WalletId = wallet.Id,
            Type = "admin_adjustment",
            Amount = req.NewBalance,
            BalanceAfter = req.NewBalance,
            Status = "Success",
            Reference = GenerateReference("ADJ"),
            Note = req.Reason,
            CreatedAt = DateTime.UtcNow
        };

        _db.WalletTransactions.Add(tx);
        await _db.SaveChangesAsync();

        return new ApiResponse<WalletResponse>(true, "Wallet adjusted.", MapWallet(wallet));
    }

    // ── LOCK / UNLOCK WALLET ──────────────────────────────────────────────
    public async Task<ApiResponse<WalletResponse>> LockWalletAsync(LockWalletRequest req)
    {
        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.UserId == req.UserId);

        if (wallet == null)
            return new ApiResponse<WalletResponse>(false, "Wallet not found.", null);

        wallet.IsLocked = req.IsLocked;
        wallet.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new ApiResponse<WalletResponse>(
            true,
            req.IsLocked ? "Wallet locked." : "Wallet unlocked.",
            MapWallet(wallet));
    }
}

// Helper classes to deserialize AuthService response
public record AuthUserResponse(bool Success, string Message, AuthUserData? Data);
public record AuthUserData(Guid UserId, string FullName, string Email,
                           string PhoneNumber, string Status, string Role);

