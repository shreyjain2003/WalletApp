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

        if (string.IsNullOrWhiteSpace(host) ||
            string.IsNullOrWhiteSpace(username) ||
            string.IsNullOrWhiteSpace(password) ||
            string.IsNullOrWhiteSpace(fromEmail) ||
            IsPlaceholder(username) ||
            IsPlaceholder(password) ||
            IsPlaceholder(fromEmail))
        {
            _logger.LogWarning("Email is enabled but SMTP configuration is incomplete. Skipping email send.");
            return;
        }

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
            mail.Subject = "Your Trunqo Verification Code";
            mail.Body = BuildOtpEmailBody(otp);
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
                _config["InternalApiKey"] ?? "TrunqoInternalKey2024");

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
        return type switch
        {
            "transfer_out"    => $"💸 Payment Sent — {title}",
            "transfer_in"     => $"💰 Money Received — {title}",
            "topup"           => $"✅ Wallet Topped Up — {title}",
            "kyc_decision"    => $"🔐 KYC Update — {title}",
            "tier_upgrade"    => $"🏆 Tier Upgrade — {title}",
            "ticket_reply"    => $"💬 Support Reply — {title}",
            "campaign_applied"=> $"🎁 Reward Applied — {title}",
            "money_request"   => $"📩 Money Request — {title}",
            _                 => $"Trunqo — {title}"
        };
    }

    private static string BuildOtpEmailBody(string otp)
    {
        return $"""
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1a1a2e 0%,#C08552 100%);padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Trunqo</h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;font-weight:500;">Digital Wallet Platform</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:22px;font-weight:700;">Verification Code</h2>
                    <p style="margin:0 0 28px;color:#6b7280;font-size:15px;line-height:1.6;">
                      Use the code below to verify your identity. This code expires in <strong>10 minutes</strong>.
                    </p>
                    <!-- OTP Box -->
                    <div style="background:#f9f5f0;border:2px dashed #C08552;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                      <p style="margin:0 0 8px;color:#9c7b6e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">Your OTP</p>
                      <p style="margin:0;color:#1a1a2e;font-size:42px;font-weight:900;letter-spacing:12px;font-family:'Courier New',monospace;">{otp}</p>
                    </div>
                    <div style="background:#fef3e2;border-left:4px solid #C08552;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px;">
                      <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
                        ⚠️ <strong>Never share this code</strong> with anyone. Trunqo will never ask for your OTP via phone or email.
                      </p>
                    </div>
                    <p style="margin:0;color:#9ca3af;font-size:13px;">
                      If you didn't request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f9f5f0;padding:20px 40px;border-top:1px solid #ede9e6;">
                    <p style="margin:0;color:#9c7b6e;font-size:12px;text-align:center;">
                      © 2025 Trunqo Financial. All rights reserved.<br>
                      This is an automated message — please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """;
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
        var iconEmoji = type switch
        {
            "transfer_out"     => "💸",
            "transfer_in"      => "💰",
            "topup"            => "✅",
            "kyc_decision"     => "🔐",
            "tier_upgrade"     => "🏆",
            "ticket_reply"     => "💬",
            "campaign_applied" => "🎁",
            "money_request"    => "📩",
            _                  => "🔔"
        };

        var accentColor = type switch
        {
            "transfer_out"  => "#ef4444",
            "transfer_in"   => "#10b981",
            "topup"         => "#10b981",
            "kyc_decision"  => "#C08552",
            "tier_upgrade"  => "#f59e0b",
            _               => "#C08552"
        };

        var amountHtml = amount.HasValue
            ? $"""
              <div style="background:#f9f5f0;border-radius:12px;padding:20px 24px;margin:24px 0;text-align:center;">
                <p style="margin:0 0 4px;color:#9c7b6e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Amount</p>
                <p style="margin:0;color:{accentColor};font-size:36px;font-weight:900;font-family:'Segoe UI',Arial,sans-serif;letter-spacing:-1px;">
                  ₹{amount.Value:N2}
                </p>
              </div>
              """
            : "";

        var detailsRows = new System.Text.StringBuilder();

        if (!string.IsNullOrWhiteSpace(counterpartyName))
        {
            var label = type == "transfer_out" ? "Sent To" : type == "transfer_in" ? "Received From" : "Counterparty";
            detailsRows.Append($"""
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #ede9e6;color:#6b7280;font-size:13px;font-weight:500;width:40%;">{label}</td>
                  <td style="padding:10px 0;border-bottom:1px solid #ede9e6;color:#1a1a2e;font-size:13px;font-weight:600;text-align:right;">
                    {WebUtility.HtmlEncode(counterpartyName)}
                    {(string.IsNullOrWhiteSpace(counterpartyEmail) ? "" : $"<br><span style='color:#9ca3af;font-size:12px;font-weight:400;'>{WebUtility.HtmlEncode(counterpartyEmail)}</span>")}
                  </td>
                </tr>
                """);
        }

        if (balanceAfter.HasValue)
        {
            detailsRows.Append($"""
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #ede9e6;color:#6b7280;font-size:13px;font-weight:500;">Balance After</td>
                  <td style="padding:10px 0;border-bottom:1px solid #ede9e6;color:#1a1a2e;font-size:13px;font-weight:700;text-align:right;">₹{balanceAfter.Value:N2}</td>
                </tr>
                """);
        }

        if (!string.IsNullOrWhiteSpace(reference))
        {
            detailsRows.Append($"""
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #ede9e6;color:#6b7280;font-size:13px;font-weight:500;">Reference</td>
                  <td style="padding:10px 0;border-bottom:1px solid #ede9e6;color:#6b7280;font-size:12px;font-family:'Courier New',monospace;text-align:right;">{WebUtility.HtmlEncode(reference)}</td>
                </tr>
                """);
        }

        if (!string.IsNullOrWhiteSpace(note))
        {
            detailsRows.Append($"""
                <tr>
                  <td style="padding:10px 0;color:#6b7280;font-size:13px;font-weight:500;">Note</td>
                  <td style="padding:10px 0;color:#1a1a2e;font-size:13px;font-style:italic;text-align:right;">{WebUtility.HtmlEncode(note)}</td>
                </tr>
                """);
        }

        var detailsTable = detailsRows.Length > 0
            ? $"""
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                {detailsRows}
              </table>
              """
            : "";

        var timestampHtml = occurredAtUtc.HasValue
            ? $"<p style='margin:0 0 24px;color:#9ca3af;font-size:12px;'>Transaction time: {occurredAtUtc.Value:dd MMM yyyy, hh:mm tt} UTC</p>"
            : "";

        return $"""
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1a1a2e 0%,#C08552 100%);padding:32px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Trunqo</h1>
                          <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">Digital Wallet Platform</p>
                        </td>
                        <td align="right">
                          <span style="font-size:36px;">{iconEmoji}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:36px 40px 28px;">
                    <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px;font-weight:700;">{WebUtility.HtmlEncode(title)}</h2>
                    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">{WebUtility.HtmlEncode(message)}</p>
                    {amountHtml}
                    {detailsTable}
                    {timestampHtml}
                    <div style="background:#f9f5f0;border-radius:10px;padding:14px 18px;">
                      <p style="margin:0;color:#9c7b6e;font-size:13px;line-height:1.5;">
                        🔒 This transaction was secured by Trunqo's bank-grade encryption. If you did not initiate this, please contact support immediately.
                      </p>
                    </div>
                  </td>
                </tr>
                <!-- CTA -->
                <tr>
                  <td style="padding:0 40px 32px;">
                    <a href="#" style="display:inline-block;background:#C08552;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">View in App →</a>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f9f5f0;padding:20px 40px;border-top:1px solid #ede9e6;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0;color:#9c7b6e;font-size:12px;">© 2025 Trunqo Financial. All rights reserved.</p>
                          <p style="margin:4px 0 0;color:#c4a882;font-size:11px;">This is an automated message — please do not reply directly to this email.</p>
                        </td>
                        <td align="right">
                          <p style="margin:0;color:#c4a882;font-size:11px;">Powered by Trunqo</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """;
    }

    private static bool IsPlaceholder(string value) =>
        value.StartsWith("__TRUNQO_", StringComparison.Ordinal);
}

public record AuthUserResponse(bool Success, string Message, AuthUserData? Data);

public record AuthUserData(Guid UserId, string FullName, string Email,
    string PhoneNumber, string Status, string Role);
