// ============================================================
// CampaignCashbackConsumer.cs — WalletService
// ------------------------------------------------------------
// Background service that listens to the "campaign_cashback" queue.
// When RewardService evaluates a campaign and determines a cashback
// reward applies, it publishes a CampaignCashbackEvent to this queue.
// This consumer credits the cashback amount directly to the user's
// wallet as a "cashback" transaction.
//
// Why is cashback handled here and not in RewardService?
//   Cashback is real money — it must be credited to the wallet balance
//   in WalletService's SQL Server database. RewardService only manages
//   reward points, not wallet balances. This separation keeps each
//   service responsible for its own data.
//
// Message flow:
//   User makes a transfer that matches a cashback campaign rule
//     → CampaignTransactionConsumer (RewardService) evaluates the rule
//     → Publishes CampaignCashbackEvent to "campaign_cashback"
//     → This consumer receives the event
//     → Credits cashback to the user's wallet balance
//     → Records a "cashback" transaction in WalletTransactions
//
// The cashback transaction appears in the user's history as type "cashback"
// and is shown with a blue color and "Cashback Reward" label in the UI.
// ============================================================

using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using WalletService.Models;
using WalletService.Repositories;

namespace WalletService.Consumers;

// BackgroundService runs ExecuteAsync once at app startup.
public class CampaignCashbackConsumer : BackgroundService
{
    // IServiceProvider creates DI scopes per message for a fresh DbContext.
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<CampaignCashbackConsumer> _logger;

    // RabbitMQ connection and channel — held open for the app lifetime.
    private IConnection? _connection;
    private IModel? _channel;

    public CampaignCashbackConsumer(
        IServiceProvider services,
        IConfiguration config,
        ILogger<CampaignCashbackConsumer> logger)
    {
        _services = services;
        _config = config;
        _logger = logger;
    }

    // ── ExecuteAsync ─────────────────────────────────────────────────────────
    // Connects to RabbitMQ and starts listening for cashback events.
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
            _channel.QueueDeclare(
                queue: "campaign_cashback",
                durable: true,    // survives broker restart
                exclusive: false,
                autoDelete: false);

            var consumer = new EventingBasicConsumer(_channel);

            consumer.Received += (_, ea) =>
            {
                // Offload to thread pool — EventingBasicConsumer does not support async.
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var json = Encoding.UTF8.GetString(ea.Body.ToArray());

                        // Deserialize the cashback event from JSON.
                        var message = JsonSerializer.Deserialize<CampaignCashbackEvent>(
                            json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                        // Skip messages with zero or negative cashback amounts.
                        if (message == null || message.CashbackAmount <= 0)
                        {
                            _channel?.BasicAck(ea.DeliveryTag, false);
                            return;
                        }

                        // Create a new DI scope for a fresh IWalletRepository.
                        using var scope = _services.CreateScope();
                        var repo = scope.ServiceProvider.GetRequiredService<IWalletRepository>();

                        // Look up the user's wallet.
                        var wallet = await repo.GetWalletByUserIdAsync(message.UserId);
                        if (wallet == null)
                        {
                            // Wallet not found — skip cashback but ack the message
                            // (retrying won't help if the wallet genuinely doesn't exist).
                            _logger.LogWarning(
                                "Cashback skipped — wallet not found for user {UserId}", message.UserId);
                            _channel?.BasicAck(ea.DeliveryTag, false);
                            return;
                        }

                        // Credit the cashback amount to the wallet balance.
                        wallet.Balance += message.CashbackAmount;
                        wallet.UpdatedAt = DateTime.UtcNow;

                        // Record the cashback as a transaction so it appears in history.
                        // Reference format: CB-{CampaignCode}-{OriginalTransactionRef}
                        // This links the cashback back to the transaction that triggered it.
                        var tx = new WalletTransaction
                        {
                            Id = Guid.NewGuid(),
                            WalletId = wallet.Id,
                            Type = "cashback",                                          // shown as "Cashback Reward" in UI
                            Amount = message.CashbackAmount,
                            BalanceAfter = wallet.Balance,
                            Status = "Success",
                            Reference = $"CB-{message.CampaignCode}-{message.TransactionRef}",
                            Note = $"Cashback from campaign {message.CampaignCode}",
                            CreatedAt = DateTime.UtcNow
                        };

                        await repo.AddTransactionAsync(tx);
                        await repo.SaveChangesAsync(); // persist wallet balance update + transaction

                        _logger.LogInformation(
                            "Cashback Rs.{Amount} credited to user {UserId} for campaign {Code}",
                            message.CashbackAmount, message.UserId, message.CampaignCode);

                        // Acknowledge — message processed successfully.
                        _channel?.BasicAck(ea.DeliveryTag, false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to process campaign_cashback event");

                        // Requeue on failure — retry when the database is available again.
                        _channel?.BasicNack(ea.DeliveryTag, false, requeue: true);
                    }
                });
            };

            // Start consuming with manual acknowledgement.
            _channel.BasicConsume(
                queue: "campaign_cashback",
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("CampaignCashbackConsumer started.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning("CampaignCashbackConsumer cannot connect to RabbitMQ: {Message}", ex.Message);
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

// ── CampaignCashbackEvent ─────────────────────────────────────────────────────
// Strongly-typed record matching the JSON published by RewardService's
// CampaignService.EvaluateAndApplyAsync when a cashback rule is triggered.
public record CampaignCashbackEvent(
    Guid UserId,            // The user who earned the cashback
    string TransactionRef,  // The original transfer/topup reference that triggered the campaign
    string CampaignCode,    // The campaign code (e.g. "FEST25") for the transaction note
    decimal CashbackAmount  // The amount to credit to the wallet (in INR)
);
