using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using WalletService.Services;

namespace WalletService.Consumers;

public class KycApprovalConsumer : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<KycApprovalConsumer> _logger;
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

            // Listen to kyc_decisions queue
            _channel.QueueDeclare(
                queue: "kyc_decisions",
                durable: true,
                exclusive: false,
                autoDelete: false);

            var consumer = new EventingBasicConsumer(_channel);

            consumer.Received += async (sender, ea) =>
            {
                try
                {
                    var body = ea.Body.ToArray();
                    var json = Encoding.UTF8.GetString(body);
                    var message = JsonSerializer.Deserialize<KycDecisionEvent>(
                        json, new JsonSerializerOptions
                        { PropertyNameCaseInsensitive = true });

                    if (message != null && message.Decision == "Approved")
                    {
                        using var scope = _services.CreateScope();
                        var walletService = scope.ServiceProvider
                            .GetRequiredService<IWalletService>();

                        // Auto create wallet for approved user
                        await walletService.GetOrCreateWalletAsync(message.UserId);

                        _logger.LogInformation(
                            "Wallet auto-created for user {userId}", message.UserId);
                    }

                    _channel.BasicAck(ea.DeliveryTag, false);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to process KYC event: {msg}", ex.Message);
                    _channel.BasicNack(ea.DeliveryTag, false, true);
                }
            };

            _channel.BasicConsume(
                queue: "kyc_decisions",
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("KycApprovalConsumer started.");
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

public record KycDecisionEvent(
    Guid UserId,
    string Decision,
    string? AdminNote
);