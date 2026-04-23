using System.Net;
using System.Net.Mail;
using System.Text.Json;

namespace NotificationService.Services;

public interface IEmailNotificationService
{
    Task SendNotificationEmailAsync(
        string userId,
        string? email,
        string title,
        string message,
        string? type = null,
        decimal? amount = null,
        string? reference = null,
        string? note = null,
        string? counterpartyName = null,
        string? counterpartyEmail = null,
        decimal? balanceAfter = null,
        DateTime? occurredAtUtc = null,
        string? otp = null 
    );
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
        string? email,
        string title,
        string message,
        string? type = null,
        decimal? amount = null,
        string? reference = null,
        string? note = null,
        string? counterpartyName = null,
        string? counterpartyEmail = null,
        decimal? balanceAfter = null,
        DateTime? occurredAtUtc = null,
        string? otp = null
    )
    {
        if (!bool.TryParse(_config["Email:Enabled"], out var enabled) || !enabled)
            return;

        var recipient = email;

        if (string.IsNullOrWhiteSpace(recipient))
        {
            recipient = await GetUserEmailByUserIdAsync(userId);
        }

        if (string.IsNullOrWhiteSpace(recipient))
        {
            _logger.LogWarning("Skipped email notification: no resolvable email for user {UserId}", userId);
            return;
        }

        var host = _config["Email:SmtpHost"];
        var fromEmail = _config["Email:FromEmail"] ?? string.Empty;
        var port = int.TryParse(_config["Email:SmtpPort"], out var parsedPort) ? parsedPort : 587;
        var useSsl = true;
        var username = _config["Email:Username"];
        var password = _config["Email:Password"];
        var fromName = _config["Email:FromName"] ?? "Trunqo";

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = useSsl,
            Credentials = new NetworkCredential(username, password)
        };

        var mail = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            IsBodyHtml = true
        };

        mail.To.Add(recipient);

        // OTP email flow
        if (!string.IsNullOrEmpty(otp))
        {
            mail.Subject = "Trunqo OTP Verification";
            mail.Body = $@"
                <div style='font-family:Arial;padding:20px'>
                    <h2 style='color:#4f46e5;'>OTP Verification</h2>
                    <p>Your OTP is:</p>
                    <h1 style='letter-spacing:5px;color:#111'>{otp}</h1>
                    <p>This OTP is valid for 10 minutes.</p>
                </div>";
        }
        else
        {
            // Standard notification email flow
            mail.Subject = BuildSubject(title, type);
            mail.Body = BuildHtmlBody(
                title, message,
                _config["Email:DisplaySender"] ?? "Trunqo",
                type, amount, reference, note,
                counterpartyName, counterpartyEmail,
                balanceAfter, occurredAtUtc);
        }

        await client.SendMailAsync(mail);
        _logger.LogInformation("Email sent to {Email}", recipient);
    }

    private async Task<string?> GetUserEmailByUserIdAsync(string userId)
    {
        if (!Guid.TryParse(userId, out var parsedUserId))
            return null;

        var baseUrl = _config["AuthService:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
            return null;

        try
        {
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
                _config["InternalApiKey"] ?? "TrunqoInternalKey");

            var response = await http.GetAsync($"/api/auth/internal/user/{parsedUserId}");
            if (!response.IsSuccessStatusCode)
                return null;

            var json = await response.Content.ReadAsStringAsync();
            var payload = JsonSerializer.Deserialize<AuthUserResponse>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return payload?.Data?.Email;
        }
        catch
        {
            return null;
        }
    }

    private static string BuildSubject(string title, string? type)
    {
        var prefix = type switch
        {
            "transfer_out" => "Payment Sent",
            "transfer_in" => "Payment Received",
            _ => "Trunqo Notification"
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
        return $"""
        <div style="font-family:Arial;padding:20px">
            <h2>{WebUtility.HtmlEncode(title)}</h2>
            <p>{WebUtility.HtmlEncode(message)}</p>
            <p style="font-size:12px;color:gray">Trunqo Notification</p>
        </div>
        """;
    }
}

public record AuthUserResponse(bool Success, string Message, AuthUserData? Data);

public record AuthUserData(Guid UserId, string FullName, string Email,
    string PhoneNumber, string Status, string Role);
