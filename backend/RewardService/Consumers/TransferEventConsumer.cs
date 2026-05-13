// ============================================================
// TransferEventConsumer.cs — RewardService
// ------------------------------------------------------------
// Background service that listens to the "wallet_transfer_rewards"
// queue, which is bound to the "wallet_transfer_exchange" fanout exchange.
//
// Purpose: Award 10 reward points to the SENDER for every successful
// money transfer. This is the base reward for using the platform.
//
// Why a fanout exchange?
//   WalletService publishes one transfer event to the fanout exchange.
//   Multiple consumers need to react to it independently:
//     - TransferEventConsumer (this file) → awards base points to sender
//     - CampaignTransactionConsumer       → evaluates campaign rules
//   A fanout exchange delivers the same message to ALL bound queues,
//   so both consumers receive every transfer event without competing.
//
// Message flow:
//   User completes a transfer in WalletService
//     → WalletService publishes to "wallet_transfer_exchange" (fanout)
//     → This consumer receives the event from "wallet_transfer_rewards"
//     → Awards 10 points to the sender
//     → BasicAck confirms processing
//
// Error handling:
//   BasicNack with requeue: true on failure — retries until the DB is available.
// ============================================================

using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using RewardService.Services;

namespace RewardService.Consumers;

// BackgroundService runs ExecuteAsync once at app startup.
public class TransferEventConsumer : BackgroundService
{
    // IServiceProvider creates DI scopes per message for a fresh IRewardService.
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<TransferEventConsumer> _logger;

    // RabbitMQ connection and channel — held open for the app lifetime.
    private IConnection? _connection;
    private RabbitMQ.Client.IModel? _channel;

    public TransferEventConsumer(IServiceProvider services,
                                 IConfiguration config,
                                 ILogger<TransferEventConsumer> logger)
    {
        _services = services;
        _config = config;
        _logger = logger;
    }

    // ── ExecuteAsync ─────────────────────────────────────────────────────────
    // Sets up the fanout exchange binding and starts consuming transfer events.
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

            // Declare the fanout exchange — idempotent, safe to call even if it exists.
            // type: "fanout" — every message is delivered to ALL bound queues.
            // durable: true — exchange survives a broker restart.
            _channel.ExchangeDeclare(exchange: "wallet_transfer_exchange", type: "fanout", durable: true);

            // Declare a dedicated durable queue for this consumer.
            // Using a named queue (not auto-generated) ensures messages are not lost
            // if this service restarts — they accumulate in the queue until consumed.
            var queueName = _channel.QueueDeclare(
                queue: "wallet_transfer_rewards",
                durable: true,
                exclusive: false,
                autoDelete: false).QueueName;

            // Bind the queue to the fanout exchange so it receives all transfer events.
            // routingKey: "" is ignored by fanout exchanges — all messages are delivered.
            _channel.QueueBind(queue: queueName, exchange: "wallet_transfer_exchange", routingKey: "");

            var consumer = new EventingBasicConsumer(_channel);

            // Note: EventingBasicConsumer supports async event handlers directly here
            // (unlike some older patterns). The async lambda is safe because we await
            // the processing before calling BasicAck/BasicNack.
            consumer.Received += async (sender, ea) =>
            {
                try
                {
                    var body = ea.Body.ToArray();
                    var json = Encoding.UTF8.GetString(body);

                    // Deserialize the transfer event from JSON.
                    var message = JsonSerializer.Deserialize<TransferEvent>(
                        json, new JsonSerializerOptions
                        { PropertyNameCaseInsensitive = true });

                    if (message != null)
                    {
                        // Create a new DI scope for a fresh IRewardService instance.
                        using var scope = _services.CreateScope();
                        var rewardService = scope.ServiceProvider
                            .GetRequiredService<IRewardService>();

                        // Award 10 base points to the sender for completing a transfer.
                        // The reference is the transfer's unique ID — used for idempotency
                        // so the same transfer cannot earn points twice.
                        await rewardService.AddPointsAsync(
                            message.SenderUserId,
                            10,                       // fixed 10 points per transfer
                            "transfer_completed",     // reason shown in rewards history
                            message.Reference);       // transfer reference for traceability

                        _logger.LogInformation(
                            "Awarded 10 points to {userId}", message.SenderUserId);
                    }

                    // Acknowledge — message processed successfully, remove from queue.
                    _channel.BasicAck(ea.DeliveryTag, false);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to process transfer event: {msg}", ex.Message);

                    // Requeue on failure — retry when the database is available again.
                    _channel.BasicNack(ea.DeliveryTag, false, requeue: true);
                }
            };

            // Start consuming with manual acknowledgement.
            _channel.BasicConsume(
                queue: queueName,
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("TransferEventConsumer started.");
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
}

// ── TransferEvent ─────────────────────────────────────────────────────────────
// Strongly-typed record matching the JSON published by WalletService
// when a transfer completes successfully.
public record TransferEvent(
    Guid SenderUserId,    // The user who sent the money — earns the 10 points
    Guid ReceiverUserId,  // The user who received the money (not used here)
    decimal Amount,       // Transfer amount in INR (not used here, used by CampaignConsumer)
    string Reference      // Unique transfer reference for idempotency
);
