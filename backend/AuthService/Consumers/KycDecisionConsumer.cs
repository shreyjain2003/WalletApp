// ============================================================
// KycDecisionConsumer.cs — AuthService
// ------------------------------------------------------------
// Background service that listens to the "kyc_decisions" RabbitMQ queue.
// When an admin approves or rejects a KYC submission in AdminService,
// AdminService publishes a KycDecisionEvent to this queue.
// This consumer picks it up and updates the User's Status and
// KycDocument fields in the AuthService SQL Server database.
//
// Why is this needed?
//   AdminService and AuthService have separate databases.
//   When an admin decides on a KYC, AuthService must be told so that:
//     - User.Status becomes "Active" (approved) or "Rejected"
//     - KycDocument.Status, AdminNote, and ReviewedAt are updated
//   This keeps both databases in sync without tight coupling.
//
// Message flow:
//   Admin clicks Approve/Reject in the UI
//     → AdminService.DecideKycAsync publishes to "kyc_decisions"
//     → This consumer receives the message
//     → Updates User and KycDocument in AuthService DB
//     → BasicAck confirms the message was processed
//
// Error handling:
//   On failure, BasicNack with requeue: true puts the message back
//   in the queue so it will be retried. This prevents data loss
//   if the database is temporarily unavailable.
// ============================================================

using AuthService.Repositories;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

namespace AuthService.Consumers;

// BackgroundService is an ASP.NET Core abstraction for long-running background tasks.
// ExecuteAsync is called once when the app starts and runs until the app stops.
public class KycDecisionConsumer : BackgroundService
{
    // IServiceProvider is used to create a new DI scope for each message.
    // This is necessary because IAuthRepository is Scoped (per-request) but
    // this consumer is a Singleton (lives for the app lifetime).
    // Creating a scope gives us a fresh DbContext per message, preventing
    // EF Core change-tracker conflicts between concurrent messages.
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<KycDecisionConsumer> _logger;

    // RabbitMQ connection and channel — created once in ExecuteAsync and
    // held open for the lifetime of the consumer.
    private IConnection? _connection;
    private RabbitMQ.Client.IModel? _channel;

    public KycDecisionConsumer(IServiceProvider services,
                               IConfiguration config,
                               ILogger<KycDecisionConsumer> logger)
    {
        _services = services;
        _config = config;
        _logger = logger;
    }

    // ── ExecuteAsync ─────────────────────────────────────────────────────────
    // Called once when the application starts.
    // Sets up the RabbitMQ connection, declares the queue, and registers
    // the message callback. Returns immediately — the callback fires
    // asynchronously whenever a message arrives.
    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            // Connect to RabbitMQ using credentials from appsettings.json.
            var factory = new ConnectionFactory
            {
                HostName = _config["RabbitMQ:Host"] ?? "localhost",
                Port = int.Parse(_config["RabbitMQ:Port"] ?? "5672"),
                UserName = _config["RabbitMQ:User"] ?? "guest",
                Password = _config["RabbitMQ:Pass"] ?? "guest"
            };

            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();

            // Declare the queue idempotently — safe to call even if it already exists.
            // durable: true — queue survives a RabbitMQ broker restart.
            _channel.QueueDeclare(queue: "kyc_decisions", durable: true, exclusive: false, autoDelete: false);

            // EventingBasicConsumer fires the Received event for each message.
            var consumer = new EventingBasicConsumer(_channel);

            consumer.Received += (sender, ea) =>
            {
                // Offload processing to the thread pool with Task.Run.
                // EventingBasicConsumer does not support async event handlers,
                // so we use the fire-and-forget pattern with _ = Task.Run(...)
                // to avoid blocking the RabbitMQ dispatch thread.
                _ = Task.Run(async () =>
                {
                    try
                    {
                        // Decode the raw bytes to a JSON string.
                        var body = ea.Body.ToArray();
                        var json = Encoding.UTF8.GetString(body);

                        // Deserialize the JSON into a KycDecisionEvent record.
                        // PropertyNameCaseInsensitive handles both camelCase and PascalCase.
                        var message = JsonSerializer.Deserialize<KycDecisionEvent>(
                            json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                        if (message != null)
                        {
                            // Create a new DI scope to get a fresh IAuthRepository
                            // (and its underlying DbContext) for this message.
                            using var scope = _services.CreateScope();
                            var repo = scope.ServiceProvider.GetRequiredService<IAuthRepository>();

                            // Load the user with their KYC document in one query.
                            var user = await repo.GetUserByIdAsync(message.UserId, includeKyc: true);

                            if (user != null)
                            {
                                // Map the KYC decision to the user's account status.
                                // "Approved" → "Active" (wallet features unlocked)
                                // "Rejected" → "Rejected" (user must resubmit KYC)
                                var newStatus = message.Decision == "Approved" ? "Active" : "Rejected";
                                user.Status = newStatus;

                                // Also update the KycDocument record if it exists.
                                if (user.KycDocument != null)
                                {
                                    user.KycDocument.Status = message.Decision;
                                    user.KycDocument.AdminNote = message.AdminNote;
                                    user.KycDocument.ReviewedAt = DateTime.UtcNow;
                                }

                                // Persist both changes in a single SaveChanges call.
                                await repo.SaveChangesAsync();
                                _logger.LogInformation("User {userId} status updated to {status}", message.UserId, newStatus);
                            }
                        }

                        // Acknowledge the message — tells RabbitMQ to remove it from the queue.
                        // multiple: false — only acknowledge this specific message.
                        _channel?.BasicAck(ea.DeliveryTag, false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Failed to process KYC decision: {msg}", ex.Message);

                        // Negative-acknowledge with requeue: true — puts the message back
                        // in the queue so it will be retried. This prevents data loss
                        // if the database is temporarily unavailable.
                        _channel?.BasicNack(ea.DeliveryTag, false, requeue: true);
                    }
                });
            };

            // Start consuming messages. autoAck: false means we manually call
            // BasicAck/BasicNack after processing — this prevents message loss
            // if the consumer crashes mid-processing.
            _channel.BasicConsume(queue: "kyc_decisions", autoAck: false, consumer: consumer);
            _logger.LogInformation("KycDecisionConsumer started.");
        }
        catch (Exception ex)
        {
            // RabbitMQ is unavailable — log a warning and continue.
            // The app still starts; KYC decisions will not be synced until
            // RabbitMQ comes back online and the service is restarted.
            _logger.LogWarning("RabbitMQ unavailable: {msg}", ex.Message);
        }

        // Return immediately — the consumer runs via the event callback, not a loop.
        return Task.CompletedTask;
    }

    // ── Dispose ──────────────────────────────────────────────────────────────
    // Called when the application shuts down.
    // Closes the RabbitMQ channel and connection gracefully.
    public override void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }
}

// ── KycDecisionEvent ─────────────────────────────────────────────────────────
// Strongly-typed record that maps to the JSON message published by AdminService.
// record types are immutable value objects — ideal for message payloads.
public record KycDecisionEvent(
    Guid UserId,       // The user whose KYC was reviewed
    string Decision,   // "Approved" or "Rejected"
    string? AdminNote  // Optional note from the admin explaining the decision
);
