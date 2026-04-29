using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using WalletService.Models;
using WalletService.Repositories;

namespace WalletService.Consumers;

/// <summary>
/// Listens to the campaign_cashback queue.
/// When a campaign awards cashback, this consumer credits the amount
/// directly to the user's wallet as a transaction.
/// </summary>
public class CampaignCashbackConsumer : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<CampaignCashbackConsumer> _logger;
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

            _channel.QueueDeclare(
                queue: "campaign_cashback",
                durable: true,
                exclusive: false,
                autoDelete: false);

            var consumer = new EventingBasicConsumer(_channel);

            consumer.Received += (_, ea) =>
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var json = Encoding.UTF8.GetString(ea.Body.ToArray());
                        var message = JsonSerializer.Deserialize<CampaignCashbackEvent>(
                            json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                        if (message == null || message.CashbackAmount <= 0)
                        {
                            _channel?.BasicAck(ea.DeliveryTag, false);
                            return;
                        }

                        using var scope = _services.CreateScope();
                        var repo = scope.ServiceProvider.GetRequiredService<IWalletRepository>();

                        var wallet = await repo.GetWalletByUserIdAsync(message.UserId);
                        if (wallet == null)
                        {
                            _logger.LogWarning(
                                "Cashback skipped — wallet not found for user {UserId}", message.UserId);
                            _channel?.BasicAck(ea.DeliveryTag, false);
                            return;
                        }

                        wallet.Balance += message.CashbackAmount;
                        wallet.UpdatedAt = DateTime.UtcNow;

                        var tx = new WalletTransaction
                        {
                            Id = Guid.NewGuid(),
                            WalletId = wallet.Id,
                            Type = "cashback",
                            Amount = message.CashbackAmount,
                            BalanceAfter = wallet.Balance,
                            Status = "Success",
                            Reference = $"CB-{message.CampaignCode}-{message.TransactionRef}",
                            Note = $"Cashback from campaign {message.CampaignCode}",
                            CreatedAt = DateTime.UtcNow
                        };

                        await repo.AddTransactionAsync(tx);
                        await repo.SaveChangesAsync();

                        _logger.LogInformation(
                            "Cashback Rs.{Amount} credited to user {UserId} for campaign {Code}",
                            message.CashbackAmount, message.UserId, message.CampaignCode);

                        _channel?.BasicAck(ea.DeliveryTag, false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to process campaign_cashback event");
                        _channel?.BasicNack(ea.DeliveryTag, false, true);
                    }
                });
            };

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

    public override void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }
}

public record CampaignCashbackEvent(
    Guid UserId,
    string TransactionRef,
    string CampaignCode,
    decimal CashbackAmount
);
