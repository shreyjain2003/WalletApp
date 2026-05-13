// ============================================================
// NotificationConsumer.cs — NotificationService
// ------------------------------------------------------------
// Background service that listens to the "notifications" RabbitMQ queue.
// Every other service in the system publishes to this queue when something
// noteworthy happens (transfer, top-up, KYC decision, tier upgrade, etc.).
// This consumer:
//   1. Saves an in-app notification to MongoDB so the user can see it
//      in the Notifications page.
//   2. Sends an HTML email via SMTP (if email is enabled in config).
//
// Special case — OTP flow:
//   When the "otp" field is present in the message, the consumer skips
//   saving an in-app notification and only sends the OTP email.
//   OTPs are transient — they should not appear in the notification history.
//
// Message format:
//   Messages can arrive in two formats:
//   1. EventWrapper<NotificationMessage> — wrapped with metadata (Id, EventType, etc.)
//      Published by AuthService's RabbitMqPublisher.
//   2. Direct NotificationMessage — flat JSON without a wrapper.
//      Published by WalletService, AdminService, RewardService publishers.
//   TryParseNotificationMessage handles both formats transparently.
//
// Error handling:
//   BasicNack with requeue: true on failure — retries until MongoDB/SMTP is available.
//   Email failures are caught separately and do NOT cause the message to be requeued
//   (the in-app notification is already saved — email is best-effort).
// ============================================================

using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using NotificationService.Models;
using NotificationService.Services;

namespace NotificationService.Consumers;

// BackgroundService runs ExecuteAsync once at app startup.
public class NotificationConsumer : BackgroundService
{
    // IServiceProvider creates DI scopes per message for fresh service instances.
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<NotificationConsumer> _logger;

    // RabbitMQ connection and channel — held open for the app lifetime.
    private IConnection? _connection;
    private IModel? _channel;

    public NotificationConsumer(IServiceProvider services,
                                IConfiguration config,
                                ILogger<NotificationConsumer> logger)
    {
        _services = services;
        _config = config;
        _logger = logger;
    }

    // ── ExecuteAsync ─────────────────────────────────────────────────────────
    // Connects to RabbitMQ and starts consuming notification events.
    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            var factory = new ConnectionFactory
            {
                HostName = _config["RabbitMQ:Host"] ?? "localhost",
                Port = int.Parse(_config["RabbitMQ:Port"] ?? "5672"),
                UserName = _config["RabbitMQ:User"] ?? "guest",
                Password = _config["RabbitMQ:Pass"] ?? "guest"
            };

            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();

            // Declare the notifications queue — idempotent, safe to call if it exists.
            // durable: true — queue survives a broker restart.
            _channel.QueueDeclare(
                queue: "notifications",
                durable: true,
                exclusive: false,
                autoDelete: false);

            var consumer = new EventingBasicConsumer(_channel);

            consumer.Received += (sender, ea) =>
            {
                // Offload to thread pool — EventingBasicConsumer does not support async
                // event handlers safely, so we use Task.Run to avoid blocking the
                // RabbitMQ dispatch thread.
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var body = ea.Body.ToArray();
                        var json = Encoding.UTF8.GetString(body);

                        // Log the raw message for debugging — helps trace notification issues.
                        _logger.LogInformation("Received message: {json}", json);

                        // Parse the message — handles both wrapped and direct formats.
                        var message = TryParseNotificationMessage(json);

                        if (message != null)
                        {
                            // Create a new DI scope for fresh service instances.
                            using var scope = _services.CreateScope();

                            var notifService = scope.ServiceProvider
                                .GetRequiredService<INotificationService>();

                            var emailService = scope.ServiceProvider
                                .GetRequiredService<IEmailNotificationService>();

                            // ── OTP FLOW ──────────────────────────────────────────────
                            // If the message contains an OTP, this is a password-reset email.
                            // We only send the email — no in-app notification is saved
                            // because OTPs are transient and should not appear in history.
                            if (!string.IsNullOrEmpty(message.Otp))
                            {
                                await emailService.SendNotificationEmailAsync(
                                    message.UserId,
                                    message.Email,
                                    "OTP Verification",
                                    "Your OTP",
                                    otp: message.Otp  // triggers the OTP email template
                                );

                                _logger.LogInformation(
                                    "OTP email sent to user {userId}",
                                    message.UserId);
                            }
                            else
                            {
                                // ── NORMAL NOTIFICATION FLOW ──────────────────────────
                                // Step 1: Save the notification to MongoDB so it appears
                                // in the user's in-app notification list.
                                await notifService.SaveAsync(new Notification
                                {
                                    Id = Guid.NewGuid(),
                                    UserId = message.UserId,
                                    Title = message.Title ?? string.Empty,
                                    Message = message.Message ?? string.Empty,
                                    Type = message.Type ?? string.Empty,
                                    IsRead = false,
                                    CreatedAt = DateTime.UtcNow
                                });

                                _logger.LogInformation(
                                    "Notification saved for user {userId}",
                                    message.UserId);

                                // Step 2: Send the email notification.
                                // This is wrapped in its own try/catch so an email failure
                                // does NOT cause the message to be requeued — the in-app
                                // notification is already saved and that is the primary record.
                                try
                                {
                                    await emailService.SendNotificationEmailAsync(
                                        message.UserId,
                                        message.Email,           // recipient email (may be null — service looks it up)
                                        message.Title ?? string.Empty,
                                        message.Message ?? string.Empty,
                                        message.Type,            // determines email template and subject prefix
                                        message.Amount,          // shown in the amount box in the email
                                        message.Reference,       // transaction reference
                                        message.Note,            // user-provided note
                                        message.CounterpartyName,   // sender/receiver name
                                        message.CounterpartyEmail,  // sender/receiver email
                                        message.BalanceAfter,    // balance after the transaction
                                        message.OccurredAtUtc    // transaction timestamp
                                    );
                                }
                                catch (Exception ex)
                                {
                                    // Log the email failure but do not rethrow — the in-app
                                    // notification is already saved and is the primary record.
                                    _logger.LogWarning(
                                        ex,
                                        "Notification saved but email failed for {UserId}",
                                        message.UserId);
                                }
                            }
                        }

                        // Acknowledge — message processed successfully.
                        _channel?.BasicAck(ea.DeliveryTag, false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Failed to process notification: {msg}", ex.Message);

                        // Requeue on failure — retry when MongoDB is available again.
                        _channel?.BasicNack(ea.DeliveryTag, false, requeue: true);
                    }
                });
            };

            // Start consuming with manual acknowledgement.
            _channel.BasicConsume(
                queue: "notifications",
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("NotificationConsumer started.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning("RabbitMQ unavailable: {msg}", ex.Message);
        }

        return Task.CompletedTask;
    }

    // ── Dispose ──────────────────────────────────────────────────────────────
    public override void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }

    // ── TryParseNotificationMessage ──────────────────────────────────────────
    // Handles two message formats:
    //   1. EventWrapper<NotificationMessage> — published by AuthService's publisher
    //      which wraps every message in an envelope with Id, EventType, CorrelationId.
    //   2. Direct NotificationMessage — published by WalletService, AdminService,
    //      RewardService publishers which send the payload directly without a wrapper.
    // Tries the wrapper format first; falls back to direct format if Payload is null.
    private static NotificationMessage? TryParseNotificationMessage(string json)
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        // Try to parse as a wrapped event (AuthService format).
        var wrapper = JsonSerializer.Deserialize<EventWrapper<NotificationMessage>>(json, options);
        if (wrapper?.Payload != null)
            return wrapper.Payload;

        // Fall back to direct payload format (WalletService/AdminService/RewardService format).
        return JsonSerializer.Deserialize<NotificationMessage>(json, options);
    }
}

// ── EventWrapper<T> ───────────────────────────────────────────────────────────
// Envelope format used by AuthService's RabbitMqPublisher.
// Contains metadata for distributed tracing alongside the actual payload.
public class EventWrapper<T>
{
    public Guid Id { get; set; }                    // Unique message ID
    public DateTime CreatedAtUtc { get; set; }      // When the event was created
    public string EventType { get; set; } = string.Empty; // Queue/event type name
    public T? Payload { get; set; }                 // The actual notification data
    public Guid CorrelationId { get; set; }         // For distributed tracing
}

// ── NotificationMessage ───────────────────────────────────────────────────────
// Strongly-typed record representing the notification payload.
// All fields except UserId are nullable because different event types
// include different subsets of fields.
public record NotificationMessage(
    string UserId,                    // The user who should receive the notification
    string? Title,                    // Notification title (e.g. "Transfer Successful")
    string? Message,                  // Notification body text
    string? Type,                     // Event type (e.g. "topup", "transfer_out", "kyc_decision")
    string? Email = null,             // Recipient email — if null, looked up from AuthService
    string? Otp = null,               // OTP value — if present, triggers OTP email flow
    decimal? Amount = null,           // Transaction amount shown in the email
    string? Reference = null,         // Transaction reference number
    string? Note = null,              // User-provided note on the transaction
    string? CounterpartyName = null,  // Name of the other party (sender or receiver)
    string? CounterpartyEmail = null, // Email of the other party
    decimal? BalanceAfter = null,     // Wallet balance after the transaction
    DateTime? OccurredAtUtc = null    // When the transaction occurred
);
