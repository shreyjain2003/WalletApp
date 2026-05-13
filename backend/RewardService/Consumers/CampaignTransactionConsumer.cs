// ============================================================
// CampaignTransactionConsumer.cs — RewardService
// ------------------------------------------------------------
// Background service that evaluates campaign rules after every
// wallet top-up and transfer. It listens to two queues:
//
//   "wallet_topup"              — plain queue, one consumer
//   "wallet_transfer_campaigns" — bound to wallet_transfer_exchange (fanout)
//
// For each event, it calls CampaignService.EvaluateAndApplyAsync which:
//   1. Finds all active campaigns matching the transaction type.
//   2. Checks each campaign's rules against the transaction amount.
//   3. Credits reward points (POINTS rules) or publishes a cashback event
//      (CASHBACK rules → WalletService.CampaignCashbackConsumer).
//   4. Records a CampaignRedemption to prevent double-applying.
//
// Why two separate queues?
//   - wallet_topup is a plain queue — only one consumer needs topup events.
//   - wallet_transfer_exchange is a fanout — both TransferEventConsumer
//     (base points) and this consumer (campaign evaluation) need transfer events.
//     Each gets its own queue bound to the same exchange.
//
// Error handling:
//   BasicNack with requeue: true on failure — retries until the DB is available.
// ============================================================

using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RewardService.Services;
using System.Text;
using System.Text.Json;

namespace RewardService.Consumers;

// BackgroundService runs ExecuteAsync once at app startup.
public class CampaignTransactionConsumer : BackgroundService
{
    // IServiceProvider creates DI scopes per message for a fresh ICampaignService.
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<CampaignTransactionConsumer> _logger;

    // RabbitMQ connection and channel — held open for the app lifetime.
    private IConnection? _connection;
    private RabbitMQ.Client.IModel? _channel;

    public CampaignTransactionConsumer(
        IServiceProvider services,
        IConfiguration config,
        ILogger<CampaignTransactionConsumer> logger)
    {
        _services = services;
        _config = config;
        _logger = logger;
    }

    // ── ExecuteAsync ─────────────────────────────────────────────────────────
    // Sets up both queue consumers (topup and transfer) and starts listening.
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

            // Declare the fanout exchange for transfer events.
            // Both TransferEventConsumer and this consumer bind separate queues to it.
            _channel.ExchangeDeclare(exchange: "wallet_transfer_exchange", type: "fanout", durable: true);

            // Dedicated durable queue for campaign evaluation of transfer events.
            // Separate from "wallet_transfer_rewards" so both consumers get every message.
            _channel.QueueDeclare("wallet_transfer_campaigns", durable: true, exclusive: false, autoDelete: false);
            _channel.QueueBind(queue: "wallet_transfer_campaigns", exchange: "wallet_transfer_exchange", routingKey: "");

            // Plain queue for top-up events — only this consumer needs them.
            _channel.QueueDeclare("wallet_topup", durable: true, exclusive: false, autoDelete: false);

            // Register the top-up event handler.
            var topupConsumer = new EventingBasicConsumer(_channel);
            topupConsumer.Received += async (_, ea) =>
                await HandleTopupAsync(ea, stoppingToken);
            _channel.BasicConsume(queue: "wallet_topup", autoAck: false, consumer: topupConsumer);

            // Register the transfer event handler.
            var transferConsumer = new EventingBasicConsumer(_channel);
            transferConsumer.Received += async (_, ea) =>
                await HandleTransferAsync(ea, stoppingToken);
            _channel.BasicConsume(queue: "wallet_transfer_campaigns", autoAck: false, consumer: transferConsumer);

            _logger.LogInformation("CampaignTransactionConsumer started.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning("CampaignTransactionConsumer cannot connect to RabbitMQ: {Message}", ex.Message);
        }

        return Task.CompletedTask;
    }

    // ── HandleTopupAsync ─────────────────────────────────────────────────────
    // Processes a wallet top-up event and evaluates campaign rules for "topup" type.
    // If a matching campaign rule exists, points or cashback are awarded.
    private async Task HandleTopupAsync(BasicDeliverEventArgs ea, CancellationToken cancellationToken)
    {
        try
        {
            var json = Encoding.UTF8.GetString(ea.Body.ToArray());
            var message = JsonSerializer.Deserialize<WalletTopupEvent>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            // Skip messages with missing reference — cannot ensure idempotency without it.
            if (message == null || string.IsNullOrWhiteSpace(message.Reference))
            {
                _channel?.BasicAck(ea.DeliveryTag, false);
                return;
            }

            // Create a new DI scope for a fresh ICampaignService instance.
            using var scope = _services.CreateScope();
            var campaignService = scope.ServiceProvider.GetRequiredService<ICampaignService>();

            // Evaluate all active campaigns for this top-up transaction.
            // The reference is used to prevent the same top-up from triggering a campaign twice.
            await campaignService.EvaluateAndApplyAsync(
                message.UserId,
                "topup",           // transaction type — matches campaign rule TransactionType
                message.Amount,    // amount — checked against rule MinAmount/MaxAmount
                message.Reference  // unique reference for idempotency
            );

            _channel?.BasicAck(ea.DeliveryTag, false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed processing wallet_topup campaign event");
            _channel?.BasicNack(ea.DeliveryTag, false, requeue: true);
        }
    }

    // ── HandleTransferAsync ──────────────────────────────────────────────────
    // Processes a wallet transfer event and evaluates campaign rules for both
    // the sender ("transfer_out") and the receiver ("transfer_in").
    // This allows campaigns to reward either side of a transfer independently.
    private async Task HandleTransferAsync(BasicDeliverEventArgs ea, CancellationToken cancellationToken)
    {
        try
        {
            var json = Encoding.UTF8.GetString(ea.Body.ToArray());
            var message = JsonSerializer.Deserialize<WalletTransferEvent>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (message == null || string.IsNullOrWhiteSpace(message.Reference))
            {
                _channel?.BasicAck(ea.DeliveryTag, false);
                return;
            }

            using var scope = _services.CreateScope();
            var campaignService = scope.ServiceProvider.GetRequiredService<ICampaignService>();

            // Evaluate campaigns for the sender (transfer_out).
            // Reference suffix "-OUT" distinguishes sender from receiver redemptions.
            await campaignService.EvaluateAndApplyAsync(
                message.SenderUserId,
                "transfer_out",
                message.Amount,
                $"{message.Reference}-OUT"
            );

            // Evaluate campaigns for the receiver (transfer_in).
            // Reference suffix "-IN" ensures the receiver's redemption is tracked separately.
            await campaignService.EvaluateAndApplyAsync(
                message.ReceiverUserId,
                "transfer_in",
                message.Amount,
                $"{message.Reference}-IN"
            );

            _channel?.BasicAck(ea.DeliveryTag, false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed processing wallet_transfer campaign event");
            _channel?.BasicNack(ea.DeliveryTag, false, requeue: true);
        }
    }

    // ── Dispose ──────────────────────────────────────────────────────────────
    public override void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }
}

// ── Event records ─────────────────────────────────────────────────────────────
// Strongly-typed records matching the JSON published by WalletService.

// Published by WalletService after a successful top-up.
public record WalletTopupEvent(
    Guid UserId,       // The user who topped up
    decimal Amount,    // Amount added in INR
    string Reference   // Unique top-up reference for idempotency
);

// Published by WalletService after a successful transfer (via fanout exchange).
public record WalletTransferEvent(
    Guid SenderUserId,    // The user who sent the money
    Guid ReceiverUserId,  // The user who received the money
    decimal Amount,       // Transfer amount in INR
    string Reference      // Unique transfer reference for idempotency
);
