using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using RewardService.Services;

namespace RewardService.Consumers;

public class TransferEventConsumer : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<TransferEventConsumer> _logger;
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

            // Declare fanout exchange for wallet_transfer so all consumers get every message
            _channel.ExchangeDeclare(exchange: "wallet_transfer_exchange", type: "fanout", durable: true);

            // Exclusive queue for this consumer instance
            var queueName = _channel.QueueDeclare(
                queue: "wallet_transfer_rewards",
                durable: true,
                exclusive: false,
                autoDelete: false).QueueName;

            _channel.QueueBind(queue: queueName, exchange: "wallet_transfer_exchange", routingKey: "");

            var consumer = new EventingBasicConsumer(_channel);

            consumer.Received += async (sender, ea) =>
            {
                try
                {
                    var body = ea.Body.ToArray();
                    var json = Encoding.UTF8.GetString(body);
                    var message = JsonSerializer.Deserialize<TransferEvent>(
                        json, new JsonSerializerOptions
                        { PropertyNameCaseInsensitive = true });

                    if (message != null)
                    {
                        using var scope = _services.CreateScope();
                        var rewardService = scope.ServiceProvider
                            .GetRequiredService<IRewardService>();

                        // Award 10 points to sender for every transfer
                        await rewardService.AddPointsAsync(
                            message.SenderUserId,
                            10,
                            "transfer_completed",
                            message.Reference);

                        _logger.LogInformation(
                            "Awarded 10 points to {userId}", message.SenderUserId);
                    }

                    _channel.BasicAck(ea.DeliveryTag, false);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to process transfer event: {msg}", ex.Message);
                    _channel.BasicNack(ea.DeliveryTag, false, true);
                }
            };

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

    public override void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }
}

public record TransferEvent(
    Guid SenderUserId,
    Guid ReceiverUserId,
    decimal Amount,
    string Reference
);