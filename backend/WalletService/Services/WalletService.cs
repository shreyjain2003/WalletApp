using System.Globalization;
using System.Net.Http.Json;
using System.Text;
using WalletService.DTOs;
using WalletService.Models;
using WalletService.Repositories;

namespace WalletService.Services;

public interface IWalletService
{
    Task<ApiResponse<WalletResponse>> GetOrCreateWalletAsync(Guid userId);
    Task<ApiResponse<WalletResponse>> TopUpAsync(Guid userId, TopUpRequest req);
    Task<ApiResponse<WalletResponse>> TransferAsync(Guid userId, TransferRequest req);
    Task<ApiResponse<List<TransactionResponse>>> GetHistoryAsync(Guid userId);
    Task<ExportFileResult?> ExportHistoryCsvAsync(Guid userId);
    Task<ExportFileResult?> ExportHistoryPdfAsync(Guid userId);
    Task<ApiResponse<WalletResponse>> GetWalletByEmailAsync(string email);
    Task<ApiResponse<WalletResponse>> AdjustWalletAsync(AdjustWalletRequest req);
    Task<ApiResponse<WalletResponse>> LockWalletAsync(LockWalletRequest req);
}

public class WalletService : IWalletService
{
    private readonly IWalletRepository _repo;
    private readonly IRabbitMqPublisher _mq;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;

    public WalletService(IWalletRepository repo, IRabbitMqPublisher mq, IConfiguration config, IHttpClientFactory httpFactory)
    {
        _repo = repo;
        _mq = mq;
        _config = config;
        _httpFactory = httpFactory;
    }

    private HttpClient CreateAuthClient()
    {
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        var http = new HttpClient(handler)
        {
            BaseAddress = new Uri(_config["AuthService:BaseUrl"]!)
        };
        http.DefaultRequestHeaders.Add(
            "X-Internal-Api-Key",
            _config["InternalApiKey"] ?? "TrunqoInternalKey");
        return http;
    }

    public async Task<ApiResponse<WalletResponse>> GetWalletByEmailAsync(string email)
    {
        using var http = CreateAuthClient();
        var response = await http.GetAsync($"/api/auth/internal/user-by-email?email={Uri.EscapeDataString(email)}");
        if (!response.IsSuccessStatusCode)
            return new ApiResponse<WalletResponse>(false, "User not found.", null);

        var json = await response.Content.ReadAsStringAsync();
        var data = System.Text.Json.JsonSerializer.Deserialize<AuthUserResponse>(
            json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (data?.Data == null)
            return new ApiResponse<WalletResponse>(false, "User not found.", null);

        var wallet = await _repo.GetWalletByUserIdAsync(data.Data.UserId);
        if (wallet == null)
            return new ApiResponse<WalletResponse>(false, "Receiver wallet not found.", null);

        return new ApiResponse<WalletResponse>(true, "OK", MapWallet(wallet));
    }

    public async Task<ApiResponse<WalletResponse>> GetOrCreateWalletAsync(Guid userId)
    {
        var wallet = await _repo.GetWalletByUserIdAsync(userId);
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
            await _repo.AddWalletAsync(wallet);
            await _repo.SaveChangesAsync();
        }

        return new ApiResponse<WalletResponse>(true, "OK", MapWallet(wallet));
    }

    public async Task<ApiResponse<WalletResponse>> TopUpAsync(Guid userId, TopUpRequest req)
    {
        if (req.Amount <= 0)
            return new ApiResponse<WalletResponse>(false, "Amount must be greater than 0.", null);

        var userStatus = await GetUserStatusAsync(userId);
        if (userStatus != "Active")
            return new ApiResponse<WalletResponse>(false,
                "Your KYC is not approved yet. Please complete KYC verification to use wallet services.", null);

        var wallet = await _repo.GetWalletByUserIdAsync(userId);
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
            await _repo.AddWalletAsync(wallet);
            await _repo.SaveChangesAsync();
        }

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

        await _repo.AddTransactionAsync(tx);
        await _repo.SaveChangesAsync();

        _mq.Publish("wallet_topup", new { UserId = userId.ToString(), Amount = req.Amount, Reference = tx.Reference });
        _mq.Publish("notifications", new
        {
            UserId = userId.ToString(),
            Title = "Top-up Successful",
            Message = $"Rs. {req.Amount} added to your wallet. New balance: Rs. {wallet.Balance}",
            Type = "topup",
            Amount = req.Amount,
            Reference = tx.Reference,
            Note = req.Note,
            BalanceAfter = wallet.Balance,
            OccurredAtUtc = tx.CreatedAt
        });

        return new ApiResponse<WalletResponse>(true, "Top-up successful.", MapWallet(wallet));
    }

    public async Task<ApiResponse<WalletResponse>> TransferAsync(Guid userId, TransferRequest req)
    {
        if (req.Amount <= 0)
            return new ApiResponse<WalletResponse>(false, "Amount must be greater than 0.", null);

        if (string.IsNullOrWhiteSpace(req.TransactionPin))
            return new ApiResponse<WalletResponse>(false, "Transaction PIN is required. Set your PIN before transferring money.", null);

        if (req.ReceiverUserId == userId)
            return new ApiResponse<WalletResponse>(false, "Cannot transfer to yourself.", null);

        var userStatus = await GetUserStatusAsync(userId);
        if (userStatus != "Active")
            return new ApiResponse<WalletResponse>(false,
                "Your KYC is not approved yet. Please complete KYC verification to use wallet services.", null);

        var pinCheck = await VerifyTransactionPinAsync(userId, req.TransactionPin);
        if (!pinCheck.Success)
            return new ApiResponse<WalletResponse>(false, pinCheck.Message, null);

        var senderUser = await GetAuthUserAsync(userId);
        var receiverUser = await GetAuthUserAsync(req.ReceiverUserId);

        var senderWallet = await _repo.GetWalletByUserIdAsync(userId);
        if (senderWallet == null)
            return new ApiResponse<WalletResponse>(false, "Your wallet not found.", null);

        if (senderWallet.IsLocked)
            return new ApiResponse<WalletResponse>(false, "Your wallet is locked.", null);

        if (senderWallet.Balance < req.Amount)
            return new ApiResponse<WalletResponse>(false, "Insufficient balance.", null);

        var receiverWallet = await _repo.GetWalletByUserIdAsync(req.ReceiverUserId);
        if (receiverWallet == null)
            return new ApiResponse<WalletResponse>(false, "Receiver wallet not found.", null);

        if (receiverWallet.IsLocked)
            return new ApiResponse<WalletResponse>(false, "Receiver wallet is locked.", null);

        var reference = GenerateReference("TF");

        await _repo.ExecuteInTransactionAsync(async () =>
        {
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

            await _repo.AddTransactionsAsync(senderTx, receiverTx);
            await _repo.SaveChangesAsync();
        });

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
            Message = $"Rs. {req.Amount} sent. New balance: Rs. {senderWallet.Balance}",
            Type = "transfer_out",
            Amount = req.Amount,
            Reference = reference + "-OUT",
            Note = req.Note,
            CounterpartyName = receiverUser?.FullName ?? "Recipient",
            CounterpartyEmail = receiverUser?.Email,
            BalanceAfter = senderWallet.Balance,
            OccurredAtUtc = DateTime.UtcNow
        });

        _mq.Publish("notifications", new
        {
            UserId = req.ReceiverUserId.ToString(),
            Title = "Money Received",
            Message = $"Rs. {req.Amount} received. New balance: Rs. {receiverWallet.Balance}",
            Type = "transfer_in",
            Amount = req.Amount,
            Reference = reference + "-IN",
            Note = req.Note,
            CounterpartyName = senderUser?.FullName ?? "Sender",
            CounterpartyEmail = senderUser?.Email,
            BalanceAfter = receiverWallet.Balance,
            OccurredAtUtc = DateTime.UtcNow
        });

        return new ApiResponse<WalletResponse>(true, "Transfer successful.", MapWallet(senderWallet));
    }

    public async Task<ApiResponse<List<TransactionResponse>>> GetHistoryAsync(Guid userId)
    {
        var transactions = await GetHistoryRecordsAsync(userId);
        if (transactions == null)
            return new ApiResponse<List<TransactionResponse>>(false, "Wallet not found.", null);

        var result = transactions.Select(t => new TransactionResponse(
            t.Id, t.Type, t.Amount, t.BalanceAfter,
            t.Status, t.Reference, t.Note, t.CreatedAt)).ToList();

        return new ApiResponse<List<TransactionResponse>>(true, "OK", result);
    }

    public async Task<ExportFileResult?> ExportHistoryCsvAsync(Guid userId)
    {
        var transactions = await GetHistoryRecordsAsync(userId);
        if (transactions == null) return null;

        var csv = new StringBuilder();
        csv.AppendLine("Id,Type,Amount,BalanceAfter,Status,Reference,Note,CreatedAtUtc");
        foreach (var transaction in transactions)
        {
            csv.AppendLine(string.Join(",",
                EscapeCsv(transaction.Id.ToString()),
                EscapeCsv(transaction.Type),
                transaction.Amount.ToString("0.00", CultureInfo.InvariantCulture),
                transaction.BalanceAfter.ToString("0.00", CultureInfo.InvariantCulture),
                EscapeCsv(transaction.Status),
                EscapeCsv(transaction.Reference),
                EscapeCsv(transaction.Note ?? string.Empty),
                EscapeCsv(transaction.CreatedAt.ToString("O", CultureInfo.InvariantCulture))));
        }

        return new ExportFileResult(
            Encoding.UTF8.GetBytes(csv.ToString()),
            "text/csv",
            $"wallet-history-{DateTime.UtcNow:yyyyMMddHHmmss}.csv");
    }

    public async Task<ExportFileResult?> ExportHistoryPdfAsync(Guid userId)
    {
        var transactions = await GetHistoryRecordsAsync(userId);
        if (transactions == null) return null;

        var lines = new List<string>
        {
            "Wallet Transaction History",
            $"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC",
            string.Empty
        };

        foreach (var transaction in transactions.Take(25))
        {
            lines.Add($"{transaction.CreatedAt:yyyy-MM-dd HH:mm} | {transaction.Type} | {transaction.Amount:0.00} | Bal {transaction.BalanceAfter:0.00}");
            lines.Add($"Ref {transaction.Reference}{(string.IsNullOrWhiteSpace(transaction.Note) ? string.Empty : $" | {transaction.Note}")}");
        }

        return new ExportFileResult(
            BuildSimplePdf(lines),
            "application/pdf",
            $"wallet-history-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf");
    }

    public async Task<ApiResponse<WalletResponse>> AdjustWalletAsync(AdjustWalletRequest req)
    {
        var wallet = await _repo.GetWalletByUserIdAsync(req.UserId);
        if (wallet == null)
            return new ApiResponse<WalletResponse>(false, "Wallet not found.", null);

        var delta = req.NewBalance - wallet.Balance;
        wallet.Balance = req.NewBalance;
        wallet.UpdatedAt = DateTime.UtcNow;

        var tx = new WalletTransaction
        {
            Id = Guid.NewGuid(),
            WalletId = wallet.Id,
            Type = "admin_adjustment",
            Amount = delta,
            BalanceAfter = req.NewBalance,
            Status = "Success",
            Reference = GenerateReference("ADJ"),
            Note = req.Reason,
            CreatedAt = DateTime.UtcNow
        };

        await _repo.AddTransactionAsync(tx);
        await _repo.SaveChangesAsync();

        return new ApiResponse<WalletResponse>(true, "Wallet adjusted.", MapWallet(wallet));
    }

    public async Task<ApiResponse<WalletResponse>> LockWalletAsync(LockWalletRequest req)
    {
        var wallet = await _repo.GetWalletByUserIdAsync(req.UserId);
        if (wallet == null)
            return new ApiResponse<WalletResponse>(false, "Wallet not found.", null);

        wallet.IsLocked = req.IsLocked;
        wallet.UpdatedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync();

        return new ApiResponse<WalletResponse>(true,
            req.IsLocked ? "Wallet locked." : "Wallet unlocked.",
            MapWallet(wallet));
    }

    private async Task<string> GetUserStatusAsync(Guid userId)
    {
        try
        {
            var user = await GetAuthUserAsync(userId);
            return user?.Status ?? "Unknown";
        }
        catch
        {
            return "Unknown";
        }
    }

    private async Task<AuthUserData?> GetAuthUserAsync(Guid userId)
    {
        try
        {
            using var http = CreateAuthClient();
            var response = await http.GetAsync($"/api/auth/internal/user/{userId}");
            if (!response.IsSuccessStatusCode)
                return null;

            var json = await response.Content.ReadAsStringAsync();
            var data = System.Text.Json.JsonSerializer.Deserialize<AuthUserResponse>(
                json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            return data?.Data;
        }
        catch
        {
            return null;
        }
    }

    private async Task<ApiResponse<object>> VerifyTransactionPinAsync(Guid userId, string? pin)
    {
        try
        {
            using var http = CreateAuthClient();
            var response = await http.PostAsJsonAsync(
                $"/api/auth/internal/user/{userId}/pin/verify",
                new { Pin = pin });

            var json = await response.Content.ReadAsStringAsync();
            var result = System.Text.Json.JsonSerializer.Deserialize<AuthApiResponse>(
                json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (!response.IsSuccessStatusCode || result?.Success != true)
                return new ApiResponse<object>(false, result?.Message ?? "Transaction PIN verification failed.", null);

            return new ApiResponse<object>(true, "PIN verified.", null);
        }
        catch
        {
            return new ApiResponse<object>(false, "Unable to verify transaction PIN right now.", null);
        }
    }

    private async Task<List<WalletTransaction>?> GetHistoryRecordsAsync(Guid userId)
    {
        var wallet = await _repo.GetWalletByUserIdAsync(userId);
        if (wallet == null)
            return null;

        return await _repo.GetTransactionsForWalletAsync(wallet.Id);
    }

    private static string GenerateReference(string prefix) =>
        $"{prefix}{DateTime.UtcNow:yyyyMMddHHmmss}{Guid.NewGuid().ToString("N")[..12].ToUpper()}";

    private static string EscapeCsv(string value)
    {
        var escaped = value.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }

    private static byte[] BuildSimplePdf(List<string> lines)
    {
        static string EscapePdf(string input) =>
            input.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");

        var content = new StringBuilder();
        content.AppendLine("BT");
        content.AppendLine("/F1 11 Tf");
        content.AppendLine("50 780 Td");

        var isFirstLine = true;
        foreach (var line in lines)
        {
            if (!isFirstLine)
                content.AppendLine("0 -16 Td");

            content.AppendLine($"({EscapePdf(line)}) Tj");
            isFirstLine = false;
        }

        content.AppendLine("ET");
        var contentStream = content.ToString();

        var objects = new List<string>
        {
            "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
            "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n",
            "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
            "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
            $"5 0 obj << /Length {Encoding.ASCII.GetByteCount(contentStream)} >> stream\n{contentStream}endstream\nendobj\n"
        };

        using var stream = new MemoryStream();
        using var writer = new StreamWriter(stream, Encoding.ASCII, leaveOpen: true);
        writer.NewLine = "\n";
        writer.Write("%PDF-1.4\n");
        writer.Flush();

        var offsets = new List<long> { 0 };
        foreach (var obj in objects)
        {
            offsets.Add(stream.Position);
            writer.Write(obj);
            writer.Flush();
        }

        var xrefStart = stream.Position;
        writer.Write($"xref\n0 {objects.Count + 1}\n");
        writer.Write("0000000000 65535 f \n");
        for (var i = 1; i <= objects.Count; i++)
        {
            writer.Write($"{offsets[i]:D10} 00000 n \n");
        }

        writer.Write($"trailer << /Size {objects.Count + 1} /Root 1 0 R >>\n");
        writer.Write($"startxref\n{xrefStart}\n%%EOF");
        writer.Flush();

        return stream.ToArray();
    }

    private static WalletResponse MapWallet(Wallet wallet) =>
        new(wallet.Id, wallet.UserId, wallet.Balance, wallet.Currency, wallet.IsLocked, wallet.CreatedAt);
}

public record AuthUserResponse(bool Success, string Message, AuthUserData? Data);
public record AuthUserData(Guid UserId, string FullName, string Email,
                           string PhoneNumber, string Status, string Role);
public record AuthApiResponse(bool Success, string Message, object? Data);
