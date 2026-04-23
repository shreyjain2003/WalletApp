using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RewardService.Services;
using System.Text;
using System.Text.Json;

namespace RewardService.Consumers;

public class CampaignTransactionConsumer : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<CampaignTransactionConsumer> _logger;
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

            // Declare fanout exchange for wallet_transfer (same as TransferEventConsumer)
            _channel.ExchangeDeclare(exchange: "wallet_transfer_exchange", type: "fanout", durable: true);

            // Separate durable queue for campaign evaluation
            _channel.QueueDeclare("wallet_transfer_campaigns", durable: true, exclusive: false, autoDelete: false);
            _channel.QueueBind(queue: "wallet_transfer_campaigns", exchange: "wallet_transfer_exchange", routingKey: "");

            // wallet_topup stays as a plain queue (only one consumer)
            _channel.QueueDeclare("wallet_topup", durable: true, exclusive: false, autoDelete: false);

            var topupConsumer = new EventingBasicConsumer(_channel);
            topupConsumer.Received += async (_, ea) =>
                await HandleTopupAsync(ea, stoppingToken);
            _channel.BasicConsume(queue: "wallet_topup", autoAck: false, consumer: topupConsumer);

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

    private async Task HandleTopupAsync(BasicDeliverEventArgs ea, CancellationToken cancellationToken)
    {
        try
        {
            var json = Encoding.UTF8.GetString(ea.Body.ToArray());
            var message = JsonSerializer.Deserialize<WalletTopupEvent>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (message == null || string.IsNullOrWhiteSpace(message.Reference))
            {
                _channel?.BasicAck(ea.DeliveryTag, false);
                return;
            }

            using var scope = _services.CreateScope();
            var campaignService = scope.ServiceProvider.GetRequiredService<ICampaignService>();
            await campaignService.EvaluateAndApplyAsync(
                message.UserId,
                "topup",
                message.Amount,
                message.Reference);

            _channel?.BasicAck(ea.DeliveryTag, false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed processing wallet_topup campaign event");
            _channel?.BasicNack(ea.DeliveryTag, false, true);
        }
    }

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

            await campaignService.EvaluateAndApplyAsync(
                message.SenderUserId,
                "transfer_out",
                message.Amount,
                $"{message.Reference}-OUT");

            await campaignService.EvaluateAndApplyAsync(
                message.ReceiverUserId,
                "transfer_in",
                message.Amount,
                $"{message.Reference}-IN");

            _channel?.BasicAck(ea.DeliveryTag, false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed processing wallet_transfer campaign event");
            _channel?.BasicNack(ea.DeliveryTag, false, true);
        }
    }

    public override void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }
}

public record WalletTopupEvent(Guid UserId, decimal Amount, string Reference);

public record WalletTransferEvent(Guid SenderUserId, Guid ReceiverUserId, decimal Amount, string Reference);
