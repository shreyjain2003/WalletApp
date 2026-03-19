using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using NotificationService.Models;
using NotificationService.Services;

namespace NotificationService.Consumers;

// IHostedService = runs in background for entire app lifetime
// Perfect for a RabbitMQ consumer that listens forever
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

    // Called once when app starts — sets up RabbitMQ connection
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

            // Listen to the "notifications" queue
            _channel.QueueDeclare(
                queue: "notifications",
                durable: true,
                exclusive: false,
                autoDelete: false);

            var consumer = new EventingBasicConsumer(_channel);

            // This fires every time a message arrives
            consumer.Received += async (sender, ea) =>
            {
                try
                {
                    // 1. Read the message bytes and deserialize
                    var body = ea.Body.ToArray();
                    var json = Encoding.UTF8.GetString(body);
                    var message = JsonSerializer.Deserialize<NotificationMessage>(
                        json, new JsonSerializerOptions
                        { PropertyNameCaseInsensitive = true });

                    if (message != null)
                    {
                        // 2. Save to MongoDB
                        // We use IServiceScope because NotificationService is Scoped
                        using var scope = _services.CreateScope();
                        var notifService = scope.ServiceProvider
                            .GetRequiredService<INotificationService>();

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
                    }

                    // 3. Acknowledge — tell RabbitMQ we processed it
                    _channel.BasicAck(ea.DeliveryTag, false);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to process notification: {msg}", ex.Message);
                    // Nack — put message back in queue
                    _channel.BasicNack(ea.DeliveryTag, false, true);
                }
            };

            // Start consuming
            _channel.BasicConsume(
                queue: "notifications",
                autoAck: false,  // we manually ack after processing
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

// Message shape coming from RabbitMQ
public record NotificationMessage(
    string UserId,
    string Title,
    string Message,
    string Type
);