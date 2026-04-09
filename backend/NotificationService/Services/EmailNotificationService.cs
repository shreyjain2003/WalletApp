using System.Net;
using System.Net.Mail;
using System.Text.Json;

namespace NotificationService.Services;

public interface IEmailNotificationService
{
    Task SendNotificationEmailAsync(
        string userId,
        string title,
        string message,
        string? type = null,
        decimal? amount = null,
        string? reference = null,
        string? note = null,
        string? counterpartyName = null,
        string? counterpartyEmail = null,
        decimal? balanceAfter = null,
        DateTime? occurredAtUtc = null);
}

public class EmailNotificationService : IEmailNotificationService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailNotificationService> _logger;

    public EmailNotificationService(
        IConfiguration config,
        ILogger<EmailNotificationService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendNotificationEmailAsync(
        string userId,
        string title,
        string message,
        string? type = null,
        decimal? amount = null,
        string? reference = null,
        string? note = null,
        string? counterpartyName = null,
        string? counterpartyEmail = null,
        decimal? balanceAfter = null,
        DateTime? occurredAtUtc = null)
    {
        if (!bool.TryParse(_config["Email:Enabled"], out var enabled) || !enabled)
            return;

        var recipient = await GetUserEmailAsync(userId);
        if (string.IsNullOrWhiteSpace(recipient))
        {
            _logger.LogWarning("Skipped email notification because user email was not found for {UserId}", userId);
            return;
        }

        var host = _config["Email:SmtpHost"];
        var fromEmail = _config["Email:FromEmail"];
        var displaySender = _config["Email:DisplaySender"] ?? "admin@walletapp.com";

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromEmail))
        {
            _logger.LogWarning("Email is enabled but SMTP host or FromEmail is missing.");
            return;
        }

        var port = int.TryParse(_config["Email:SmtpPort"], out var parsedPort) ? parsedPort : 587;
        var useSsl = !bool.TryParse(_config["Email:UseSsl"], out var parsedUseSsl) || parsedUseSsl;
        var username = _config["Email:Username"];
        var password = _config["Email:Password"];
        var fromName = _config["Email:FromName"] ?? "WalletApp Official";

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            _logger.LogWarning("Email is enabled but SMTP credentials are incomplete.");
            return;
        }

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = BuildSubject(title, type),
            Body = BuildHtmlBody(
                title, message, displaySender, type, amount, reference, note,
                counterpartyName, counterpartyEmail, balanceAfter, occurredAtUtc),
            IsBodyHtml = true
        };

        mailMessage.To.Add(recipient);

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = useSsl,
            Credentials = new NetworkCredential(username, password)
        };

        await client.SendMailAsync(mailMessage);
        _logger.LogInformation("Email notification sent to {Email}", recipient);
    }

    private async Task<string?> GetUserEmailAsync(string userId)
    {
        var baseUrl = _config["AuthService:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
            return null;

        using var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        using var http = new HttpClient(handler)
        {
            BaseAddress = new Uri(baseUrl)
        };
        http.DefaultRequestHeaders.Add(
            "X-Internal-Api-Key",
            _config["InternalApiKey"] ?? "WalletAppInternalKey");

        var response = await http.GetAsync($"/api/auth/internal/user/{userId}");
        if (!response.IsSuccessStatusCode)
            return null;

        var json = await response.Content.ReadAsStringAsync();
        var userResponse = JsonSerializer.Deserialize<AuthUserResponse>(
            json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        return userResponse?.Data?.Email;
    }

    private static string BuildSubject(string title, string? type)
    {
        var prefix = type switch
        {
            "transfer_out" => "WalletApp Payment Sent",
            "transfer_in" => "WalletApp Payment Received",
            "money_request" => "WalletApp Money Request",
            "topup" => "WalletApp Wallet Top-up",
            _ => "WalletApp Notification"
        };

        return $"{prefix}: {title}";
    }

    private static string BuildHtmlBody(
        string title,
        string message,
        string displaySender,
        string? type,
        decimal? amount,
        string? reference,
        string? note,
        string? counterpartyName,
        string? counterpartyEmail,
        decimal? balanceAfter,
        DateTime? occurredAtUtc)
    {
        var details = new List<string>();
        if (amount.HasValue) details.Add($"<tr><td style=\"padding:8px 0;color:#6b7280;\">Amount</td><td style=\"padding:8px 0;font-weight:600;\">Rs. {amount.Value:0.00}</td></tr>");
        if (!string.IsNullOrWhiteSpace(reference)) details.Add($"<tr><td style=\"padding:8px 0;color:#6b7280;\">Reference</td><td style=\"padding:8px 0;font-weight:600;\">{WebUtility.HtmlEncode(reference)}</td></tr>");
        if (!string.IsNullOrWhiteSpace(counterpartyName))
        {
            var counterpartyLabel = type switch
            {
                "transfer_in" => "Sender",
                "transfer_out" => "Recipient",
                "money_request" => "Requester",
                _ => "Counterparty"
            };
            details.Add($"<tr><td style=\"padding:8px 0;color:#6b7280;\">{counterpartyLabel}</td><td style=\"padding:8px 0;font-weight:600;\">{WebUtility.HtmlEncode(counterpartyName)}{(string.IsNullOrWhiteSpace(counterpartyEmail) ? string.Empty : $" ({WebUtility.HtmlEncode(counterpartyEmail)})")}</td></tr>");
        }
        if (balanceAfter.HasValue) details.Add($"<tr><td style=\"padding:8px 0;color:#6b7280;\">Balance After</td><td style=\"padding:8px 0;font-weight:600;\">Rs. {balanceAfter.Value:0.00}</td></tr>");
        if (!string.IsNullOrWhiteSpace(note)) details.Add($"<tr><td style=\"padding:8px 0;color:#6b7280;\">Note</td><td style=\"padding:8px 0;font-weight:600;\">{WebUtility.HtmlEncode(note)}</td></tr>");
        if (occurredAtUtc.HasValue) details.Add($"<tr><td style=\"padding:8px 0;color:#6b7280;\">Date (UTC)</td><td style=\"padding:8px 0;font-weight:600;\">{occurredAtUtc.Value:yyyy-MM-dd HH:mm:ss}</td></tr>");

        return $"""
            <html>
              <body style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px; color:#1f2937;">
                <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:24px; border:1px solid #e5e7eb;">
                  <h2 style="margin-top:0; color:#1d4ed8;">{WebUtility.HtmlEncode(title)}</h2>
                  <p style="font-size:15px; line-height:1.6;">{WebUtility.HtmlEncode(message)}</p>
                  {(details.Count > 0 ? $"<table style=\"width:100%; margin-top:16px; border-top:1px solid #e5e7eb;\">{string.Join(string.Empty, details)}</table>" : string.Empty)}
                  <p style="margin-top:24px; font-size:13px; color:#6b7280;">This is an automated transaction email from WalletApp Official.</p>
                  <p style="margin-top:8px; font-size:13px; color:#6b7280;">Official sender: {WebUtility.HtmlEncode(displaySender)}</p>
                </div>
              </body>
            </html>
            """;
    }
}

public record AuthUserResponse(bool Success, string Message, AuthUserData? Data);

public record AuthUserData(Guid UserId, string FullName, string Email,
    string PhoneNumber, string Status, string Role);
