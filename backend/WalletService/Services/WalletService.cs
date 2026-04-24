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
        var wallet = await _repo.GetWalletByUserIdAsync(userId);
        if (wallet == null) return null;

        var transactions = await _repo.GetTransactionsForWalletAsync(wallet.Id);
        var generatedAtUtc = DateTime.UtcNow;
        var authUser = await GetAuthUserAsync(userId);
        var userFullName = string.IsNullOrWhiteSpace(authUser?.FullName) ? "N/A" : authUser!.FullName;
        var totalCredits = transactions.Where(IsCredit).Sum(t => Math.Abs(t.Amount));
        var totalDebits = transactions.Where(IsDebit).Sum(t => Math.Abs(t.Amount));

        var csv = new StringBuilder();
        csv.AppendLine("Trunqo Wallet Statement");
        csv.AppendLine($"Generated At (UTC),{EscapeCsv(generatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture))}");
        csv.AppendLine($"Account Holder,{EscapeCsv(userFullName)}");
        csv.AppendLine($"Wallet Id,{EscapeCsv(wallet.Id.ToString())}");
        csv.AppendLine($"User Id,{EscapeCsv(userId.ToString())}");
        csv.AppendLine($"Currency,{EscapeCsv(wallet.Currency)}");
        csv.AppendLine($"Current Balance,{EscapeCsv(FormatCurrency(wallet.Balance, wallet.Currency))}");
        csv.AppendLine($"Total Transactions,{transactions.Count.ToString(CultureInfo.InvariantCulture)}");
        csv.AppendLine($"Total Credits,{EscapeCsv(FormatCurrency(totalCredits, wallet.Currency))}");
        csv.AppendLine($"Total Debits,{EscapeCsv(FormatCurrency(totalDebits, wallet.Currency))}");
        csv.AppendLine();
        csv.AppendLine("Date (UTC),Transaction Type,Direction,Amount,Balance After,Status,Reference,Note");

        foreach (var transaction in transactions)
        {
            var direction = IsDebit(transaction) ? "Debit" : "Credit";
            csv.AppendLine(string.Join(",",
                EscapeCsv(transaction.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)),
                EscapeCsv(ToDisplayTransactionType(transaction.Type)),
                EscapeCsv(direction),
                EscapeCsv(FormatSignedCurrency(transaction.Amount, wallet.Currency, IsDebit(transaction))),
                EscapeCsv(FormatCurrency(transaction.BalanceAfter, wallet.Currency)),
                EscapeCsv(transaction.Status),
                EscapeCsv(transaction.Reference),
                EscapeCsv(transaction.Note ?? string.Empty)));
        }

        return new ExportFileResult(
            new UTF8Encoding(true).GetBytes(csv.ToString()),
            "text/csv",
            $"wallet-statement-{DateTime.UtcNow:yyyyMMddHHmmss}.csv");
    }

    public async Task<ExportFileResult?> ExportHistoryPdfAsync(Guid userId)
    {
        var wallet = await _repo.GetWalletByUserIdAsync(userId);
        if (wallet == null) return null;

        var transactions = await _repo.GetTransactionsForWalletAsync(wallet.Id);
        var authUser = await GetAuthUserAsync(userId);
        var userFullName = string.IsNullOrWhiteSpace(authUser?.FullName) ? "N/A" : authUser!.FullName;
        var report = BuildStatementReport(wallet, userId, userFullName, transactions, DateTime.UtcNow);

        return new ExportFileResult(
            BuildProfessionalPdf(report),
            "application/pdf",
            $"wallet-statement-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf");
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

    private static StatementReport BuildStatementReport(
        Wallet wallet,
        Guid userId,
        string userFullName,
        List<WalletTransaction> transactions,
        DateTime generatedAtUtc)
    {
        var rows = transactions.Select(t =>
        {
            var isDebit = IsDebit(t);
            return new StatementRow(
                t.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                ToDisplayTransactionType(t.Type),
                isDebit ? "Debit" : "Credit",
                FormatSignedCurrency(t.Amount, wallet.Currency, isDebit),
                FormatCurrency(t.BalanceAfter, wallet.Currency),
                t.Status,
                t.Reference,
                t.Note ?? string.Empty);
        }).ToList();

        return new StatementReport(
            wallet.Id.ToString(),
            userId.ToString(),
            userFullName,
            wallet.Currency,
            FormatCurrency(wallet.Balance, wallet.Currency),
            FormatCurrency(transactions.Where(IsCredit).Sum(t => Math.Abs(t.Amount)), wallet.Currency),
            FormatCurrency(transactions.Where(IsDebit).Sum(t => Math.Abs(t.Amount)), wallet.Currency),
            transactions.Count.ToString(CultureInfo.InvariantCulture),
            generatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
            rows);
    }

    private static bool IsDebit(WalletTransaction transaction) =>
        transaction.Amount < 0 || transaction.Type is "transfer_out";

    private static bool IsCredit(WalletTransaction transaction) => !IsDebit(transaction);

    private static string ToDisplayTransactionType(string type)
    {
        if (string.IsNullOrWhiteSpace(type)) return "Transaction";
        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(type.Replace("_", " ").ToLowerInvariant());
    }

    private static string FormatCurrency(decimal value, string currency) =>
        $"{currency.ToUpperInvariant()} {value:0.00}";

    private static string FormatSignedCurrency(decimal value, string currency, bool isDebit)
    {
        var amount = Math.Abs(value);
        var sign = isDebit ? "-" : "+";
        return $"{currency.ToUpperInvariant()} {sign}{amount:0.00}";
    }

    private static byte[] BuildProfessionalPdf(StatementReport report)
    {
        var pages = BuildPdfPages(report);
        return BuildPdfDocument(pages);
    }

    private static List<string> BuildPdfPages(StatementReport report)
    {
        const double left = 40;
        const double topHeaderStart = 720;
        const double bottomMargin = 56;
        const double rowHeight = 18;
        const double tableWidth = 532;
        var columnWidths = new[] { 86d, 80d, 60d, 72d, 72d, 56d, 64d, 42d };
        var columnHeaders = new[] { "Date (UTC)", "Type", "Dir", "Amount", "Balance", "Status", "Reference", "Note" };
        var rowIndex = 0;
        var pageNumber = 1;
        var pages = new List<string>();

        while (rowIndex < report.Rows.Count || (report.Rows.Count == 0 && pageNumber == 1))
        {
            var canvas = new PdfCanvas();
            var isFirstPage = pageNumber == 1;

            if (isFirstPage)
            {
                canvas.FillRect(0, topHeaderStart, 612, 72, 0.05, 0.39, 0.45);
                canvas.Text(left, 764, 18, "TRUNQO DIGITAL WALLET", true, 1, 1, 1);
                canvas.Text(left, 744, 10, "Account Statement", false, 0.86, 0.95, 0.96);
                canvas.Text(420, 764, 10, $"Generated: {report.GeneratedAtUtc} UTC", false, 0.86, 0.95, 0.96);
                canvas.Text(420, 748, 10, $"Wallet: {report.WalletId}", false, 0.86, 0.95, 0.96);

                DrawSummaryCard(canvas, left, 650, 168, 56, "Current Balance", report.CurrentBalance);
                DrawSummaryCard(canvas, left + 182, 650, 168, 56, "Total Credits", report.TotalCredits);
                DrawSummaryCard(canvas, left + 364, 650, 168, 56, "Total Debits", report.TotalDebits);
                canvas.Text(left, 628, 9, $"Account Holder: {report.UserFullName}", false, 0.35, 0.39, 0.43);
                canvas.Text(left, 614, 9, $"Transactions: {report.TotalTransactions}   User ID: {report.UserId}", false, 0.35, 0.39, 0.43);
            }
            else
            {
                canvas.FillRect(0, 748, 612, 44, 0.05, 0.39, 0.45);
                canvas.Text(left, 766, 13, "TRUNQO ACCOUNT STATEMENT", true, 1, 1, 1);
                canvas.Text(420, 766, 9, $"Wallet: {report.WalletId}", false, 0.86, 0.95, 0.96);
            }

            var tableTop = isFirstPage ? 600d : 716d;
            DrawTableHeader(canvas, left, tableTop, tableWidth, columnWidths, columnHeaders);

            var rowY = tableTop - rowHeight;
            var rowsDrawnOnPage = 0;
            while (rowIndex < report.Rows.Count && (rowY - rowHeight) > bottomMargin)
            {
                var row = report.Rows[rowIndex];
                var striped = rowsDrawnOnPage % 2 == 1;
                if (striped)
                {
                    canvas.FillRect(left, rowY - rowHeight + 1, tableWidth, rowHeight - 1, 0.97, 0.98, 0.99);
                }

                var note = Truncate(row.Note, 18);
                var values = new[]
                {
                    row.DateUtc,
                    Truncate(row.Type, 14),
                    row.Direction,
                    row.Amount,
                    row.BalanceAfter,
                    Truncate(row.Status, 10),
                    Truncate(row.Reference, 12),
                    note
                };

                DrawRow(canvas, left, rowY, columnWidths, values);

                rowIndex++;
                rowsDrawnOnPage++;
                rowY -= rowHeight;
            }

            if (report.Rows.Count == 0 && pageNumber == 1)
            {
                canvas.Text(left + 170, tableTop - 58, 12, "No transactions available for this period.", false, 0.3, 0.34, 0.38);
            }

            canvas.StrokeLine(left, 44, left + tableWidth, 44, 0.8, 0.84, 0.88, 1);
            canvas.Text(left, 30, 9, "This is a system-generated statement from Trunqo.", false, 0.38, 0.42, 0.46);
            canvas.Text(500, 30, 9, $"Page {pageNumber}", false, 0.38, 0.42, 0.46);

            pages.Add(canvas.ToString());
            pageNumber++;
        }

        return pages;
    }

    private static void DrawSummaryCard(PdfCanvas canvas, double x, double y, double width, double height, string title, string value)
    {
        canvas.FillRect(x, y, width, height, 0.96, 0.98, 1);
        canvas.StrokeRect(x, y, width, height, 0.82, 0.88, 0.93, 1);
        canvas.Text(x + 10, y + 38, 9, title, false, 0.29, 0.34, 0.39);
        canvas.Text(x + 10, y + 18, 13, value, true, 0.06, 0.42, 0.48);
    }

    private static void DrawTableHeader(
        PdfCanvas canvas,
        double left,
        double y,
        double tableWidth,
        IReadOnlyList<double> widths,
        IReadOnlyList<string> headers)
    {
        canvas.FillRect(left, y - 18, tableWidth, 18, 0.07, 0.11, 0.17);
        canvas.StrokeRect(left, y - 18, tableWidth, 18, 0.16, 0.2, 0.27, 1);

        var x = left + 4;
        for (var i = 0; i < headers.Count; i++)
        {
            canvas.Text(x, y - 13, 8, headers[i], true, 1, 1, 1);
            x += widths[i];
        }
    }

    private static void DrawRow(PdfCanvas canvas, double left, double y, IReadOnlyList<double> widths, IReadOnlyList<string> values)
    {
        var x = left + 4;
        for (var i = 0; i < values.Count; i++)
        {
            canvas.Text(x, y - 13, 8, values[i], false, 0.12, 0.16, 0.2);
            x += widths[i];
        }
    }

    private static byte[] BuildPdfDocument(IReadOnlyList<string> pagesContent)
    {
        var objectStrings = new List<string>();
        var fontRegularId = 3;
        var fontBoldId = 4;

        var pageObjectIds = new List<int>();
        var contentObjectIds = new List<int>();
        for (var i = 0; i < pagesContent.Count; i++)
        {
            pageObjectIds.Add(5 + (i * 2));
            contentObjectIds.Add(6 + (i * 2));
        }

        var kids = string.Join(" ", pageObjectIds.Select(id => $"{id} 0 R"));
        objectStrings.Add("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
        objectStrings.Add($"2 0 obj << /Type /Pages /Count {pagesContent.Count} /Kids [{kids}] >> endobj\n");
        objectStrings.Add($"{fontRegularId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n");
        objectStrings.Add($"{fontBoldId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n");

        for (var i = 0; i < pagesContent.Count; i++)
        {
            var pageId = pageObjectIds[i];
            var contentId = contentObjectIds[i];
            var content = pagesContent[i];

            objectStrings.Add(
                $"{pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
                $"/Resources << /Font << /F1 {fontRegularId} 0 R /F2 {fontBoldId} 0 R >> >> " +
                $"/Contents {contentId} 0 R >> endobj\n");

            objectStrings.Add(
                $"{contentId} 0 obj << /Length {Encoding.ASCII.GetByteCount(content)} >> stream\n" +
                $"{content}endstream\nendobj\n");
        }

        using var stream = new MemoryStream();
        using var writer = new StreamWriter(stream, Encoding.ASCII, leaveOpen: true);
        writer.NewLine = "\n";
        writer.Write("%PDF-1.4\n");
        writer.Flush();

        var offsets = new List<long> { 0 };
        foreach (var obj in objectStrings)
        {
            offsets.Add(stream.Position);
            writer.Write(obj);
            writer.Flush();
        }

        var xrefStart = stream.Position;
        writer.Write($"xref\n0 {objectStrings.Count + 1}\n");
        writer.Write("0000000000 65535 f \n");
        for (var i = 1; i <= objectStrings.Count; i++)
        {
            writer.Write($"{offsets[i]:D10} 00000 n \n");
        }

        writer.Write($"trailer << /Size {objectStrings.Count + 1} /Root 1 0 R >>\n");
        writer.Write($"startxref\n{xrefStart}\n%%EOF");
        writer.Flush();
        return stream.ToArray();
    }

    private static string Truncate(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength) return value;
        return $"{value[..(maxLength - 3)]}...";
    }

    private sealed record StatementReport(
        string WalletId,
        string UserId,
        string UserFullName,
        string Currency,
        string CurrentBalance,
        string TotalCredits,
        string TotalDebits,
        string TotalTransactions,
        string GeneratedAtUtc,
        IReadOnlyList<StatementRow> Rows);

    private sealed record StatementRow(
        string DateUtc,
        string Type,
        string Direction,
        string Amount,
        string BalanceAfter,
        string Status,
        string Reference,
        string Note);

    private sealed class PdfCanvas
    {
        private readonly StringBuilder _sb = new();

        public void FillRect(double x, double y, double width, double height, double r, double g, double b)
        {
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.###} {1:0.###} {2:0.###} rg\n", r, g, b);
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} {1:0.##} {2:0.##} {3:0.##} re f\n", x, y, width, height);
        }

        public void StrokeRect(double x, double y, double width, double height, double r, double g, double b, double lineWidth)
        {
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.###} {1:0.###} {2:0.###} RG\n", r, g, b);
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} w\n", lineWidth);
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} {1:0.##} {2:0.##} {3:0.##} re S\n", x, y, width, height);
        }

        public void StrokeLine(double x1, double y1, double x2, double y2, double r, double g, double b, double lineWidth)
        {
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.###} {1:0.###} {2:0.###} RG\n", r, g, b);
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} w\n", lineWidth);
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} {1:0.##} m {2:0.##} {3:0.##} l S\n", x1, y1, x2, y2);
        }

        public void Text(double x, double y, int size, string text, bool bold, double r, double g, double b)
        {
            var safeText = text.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
            _sb.Append("BT\n");
            _sb.AppendFormat(CultureInfo.InvariantCulture, "/{0} {1} Tf\n", bold ? "F2" : "F1", size);
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.###} {1:0.###} {2:0.###} rg\n", r, g, b);
            _sb.AppendFormat(CultureInfo.InvariantCulture, "{0:0.##} {1:0.##} Td\n", x, y);
            _sb.AppendFormat(CultureInfo.InvariantCulture, "({0}) Tj\n", safeText);
            _sb.Append("ET\n");
        }

        public override string ToString() => _sb.ToString();
    }

    private static WalletResponse MapWallet(Wallet wallet) =>
        new(wallet.Id, wallet.UserId, wallet.Balance, wallet.Currency, wallet.IsLocked, wallet.CreatedAt);
}

public record AuthUserResponse(bool Success, string Message, AuthUserData? Data);
public record AuthUserData(Guid UserId, string FullName, string Email,
                           string PhoneNumber, string Status, string Role);
public record AuthApiResponse(bool Success, string Message, object? Data);
