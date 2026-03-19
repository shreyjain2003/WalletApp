using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using AuthService.Data;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Consumers;

public class KycDecisionConsumer : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<KycDecisionConsumer> _logger;
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

                    if (message != null)
                    {
                        using var scope = _services.CreateScope();
                        var db = scope.ServiceProvider
                            .GetRequiredService<AuthDbContext>();

                        // Find user and update status
                        var user = await db.Users
                            .FirstOrDefaultAsync(u => u.Id == message.UserId);

                        if (user != null)
                        {
                            // Update user status based on decision
                            user.Status = message.Decision == "Approved"
                                ? "Active" : "Rejected";

                            // Update KYC document status
                            var kyc = await db.KycDocuments
                                .FirstOrDefaultAsync(k => k.UserId == message.UserId);

                            if (kyc != null)
                            {
                                kyc.Status = message.Decision;
                                kyc.AdminNote = message.AdminNote;
                                kyc.ReviewedAt = DateTime.UtcNow;
                            }

                            await db.SaveChangesAsync();

                            _logger.LogInformation(
                                "User {userId} status updated to {status}",
                                message.UserId, user.Status);
                        }
                    }

                    _channel.BasicAck(ea.DeliveryTag, false);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to process KYC decision: {msg}", ex.Message);
                    _channel.BasicNack(ea.DeliveryTag, false, true);
                }
            };

            _channel.BasicConsume(
                queue: "kyc_decisions",
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("KycDecisionConsumer started.");
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