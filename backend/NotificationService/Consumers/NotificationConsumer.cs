using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using NotificationService.Models;
using NotificationService.Services;

namespace NotificationService.Consumers;

public class NotificationConsumer : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<NotificationConsumer> _logger;
    private IConnection? _connection;
    private RabbitMQ.Client.IModel? _channel;

    public NotificationConsumer(IServiceProvider services,
                                IConfiguration config,
                                ILogger<NotificationConsumer> logger)
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
                queue: "notifications",
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
                    var message = JsonSerializer.Deserialize<NotificationMessage>(
                        json, new JsonSerializerOptions
                        { PropertyNameCaseInsensitive = true });

                    if (message != null)
                    {
                        using var scope = _services.CreateScope();
                        var notifService = scope.ServiceProvider
                            .GetRequiredService<INotificationService>();
                        var emailService = scope.ServiceProvider
                            .GetRequiredService<IEmailNotificationService>();

                        await notifService.SaveAsync(new Notification
                        {
                            Id = Guid.NewGuid(),
                            UserId = message.UserId,
                            Title = message.Title,
                            Message = message.Message,
                            Type = message.Type,
                            IsRead = false,
                            CreatedAt = DateTime.UtcNow
                        });

                        _logger.LogInformation(
                            "Notification saved for user {userId}", message.UserId);

                        try
                        {
                            await emailService.SendNotificationEmailAsync(
                                message.UserId,
                                message.Title,
                                message.Message,
                                message.Type,
                                message.Amount,
                                message.Reference,
                                message.Note,
                                message.CounterpartyName,
                                message.CounterpartyEmail,
                                message.BalanceAfter,
                                message.OccurredAtUtc);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex,
                                "Notification was saved but email delivery failed for user {UserId}",
                                message.UserId);
                        }
                    }

                    _channel.BasicAck(ea.DeliveryTag, false);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to process notification: {msg}", ex.Message);
                    _channel.BasicNack(ea.DeliveryTag, false, true);
                }
            };

            _channel.BasicConsume(
                queue: "notifications",
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("NotificationConsumer started.");
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

public record NotificationMessage(
    string UserId,
    string Title,
    string Message,
    string Type,
    decimal? Amount = null,
    string? Reference = null,
    string? Note = null,
    string? CounterpartyName = null,
    string? CounterpartyEmail = null,
    decimal? BalanceAfter = null,
    DateTime? OccurredAtUtc = null
);
