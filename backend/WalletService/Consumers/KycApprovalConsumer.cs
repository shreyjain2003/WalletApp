// ============================================================
// KycApprovalConsumer.cs — WalletService
// ------------------------------------------------------------
// Background service that listens to the "kyc_decisions" RabbitMQ queue.
// When an admin approves a user's KYC in AdminService, this consumer
// automatically creates a wallet for that user in WalletService.
//
// Why is this needed?
//   WalletService and AuthService have separate databases.
//   A user cannot use wallet features until their KYC is approved.
//   Rather than polling AuthService, WalletService reacts to the
//   kyc_decisions event published by AdminService.
//
// Message flow:
//   Admin approves KYC in the admin panel
//     → AdminService publishes KycDecisionEvent to "kyc_decisions"
//     → This consumer receives the message
//     → If Decision == "Approved", calls GetOrCreateWalletAsync
//     → A wallet with zero balance is created for the user
//     → User can now top up and transfer money
//
// Note: Both KycApprovalConsumer (WalletService) and KycDecisionConsumer
// (AuthService) listen to the same "kyc_decisions" queue. RabbitMQ
// delivers each message to only ONE consumer per queue — this works
// because both services have their own separate queue declarations.
// ============================================================

using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using WalletService.Services;

namespace WalletService.Consumers;

// BackgroundService runs ExecuteAsync once at app startup and keeps it
// alive until the application shuts down.
public class KycApprovalConsumer : BackgroundService
{
    // IServiceProvider creates DI scopes per message so we get a fresh
    // IWalletService (and its DbContext) for each message processed.
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<KycApprovalConsumer> _logger;

    // RabbitMQ connection and channel — held open for the app lifetime.
    private IConnection? _connection;
    private RabbitMQ.Client.IModel? _channel;

    public KycApprovalConsumer(IServiceProvider services,
                               IConfiguration config,
                               ILogger<KycApprovalConsumer> logger)
    {
        _services = services;
        _config = config;
        _logger = logger;
    }

    // ── ExecuteAsync ─────────────────────────────────────────────────────────
    // Sets up the RabbitMQ connection and starts listening for KYC decision events.
    // Returns immediately — message processing happens in the event callback.
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

            // Declare the queue — idempotent, safe to call even if it already exists.
            // durable: true — queue survives a RabbitMQ broker restart.
            _channel.QueueDeclare(
                queue: "kyc_decisions",
                durable: true,
                exclusive: false,
                autoDelete: false);

            var consumer = new EventingBasicConsumer(_channel);

            consumer.Received += (sender, ea) =>
            {
                // Offload to thread pool — EventingBasicConsumer does not support
                // async event handlers, so we use Task.Run to avoid blocking the
                // RabbitMQ dispatch thread.
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var body = ea.Body.ToArray();
                        var json = Encoding.UTF8.GetString(body);

                        // Deserialize the JSON message into a strongly-typed record.
                        var message = JsonSerializer.Deserialize<KycDecisionEvent>(
                            json, new JsonSerializerOptions
                            { PropertyNameCaseInsensitive = true });

                        // Only create a wallet for approved KYC decisions.
                        // Rejected decisions do not require any wallet action.
                        if (message != null && message.Decision == "Approved")
                        {
                            // Create a new DI scope to get a fresh IWalletService
                            // (and its underlying DbContext) for this message.
                            using var scope = _services.CreateScope();
                            var walletService = scope.ServiceProvider
                                .GetRequiredService<IWalletService>();

                            // GetOrCreateWalletAsync is idempotent — if a wallet
                            // already exists for this user, it returns the existing one.
                            await walletService.GetOrCreateWalletAsync(message.UserId);

                            _logger.LogInformation(
                                "Wallet auto-created for user {userId}", message.UserId);
                        }

                        // Acknowledge the message — tells RabbitMQ to remove it from the queue.
                        _channel?.BasicAck(ea.DeliveryTag, false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Failed to process KYC event: {msg}", ex.Message);

                        // Negative-acknowledge with requeue: true — puts the message back
                        // in the queue for retry. Prevents wallet creation from being skipped
                        // if the database is temporarily unavailable.
                        _channel?.BasicNack(ea.DeliveryTag, false, requeue: true);
                    }
                });
            };

            // Start consuming. autoAck: false means we manually ack/nack each message.
            _channel.BasicConsume(
                queue: "kyc_decisions",
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("KycApprovalConsumer started.");
        }
        catch (Exception ex)
        {
            // RabbitMQ is unavailable — log and continue. The app still starts.
            _logger.LogWarning("RabbitMQ unavailable: {msg}", ex.Message);
        }

        return Task.CompletedTask;
    }

    // ── Dispose ──────────────────────────────────────────────────────────────
    // Closes the RabbitMQ channel and connection when the app shuts down.
    public override void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }
}

// ── KycDecisionEvent ─────────────────────────────────────────────────────────
// Strongly-typed record matching the JSON published by AdminService.
// record types are immutable — ideal for message payloads.
public record KycDecisionEvent(
    Guid UserId,       // The user whose KYC was reviewed
    string Decision,   // "Approved" or "Rejected"
    string? AdminNote  // Optional admin note (not used by WalletService)
);
