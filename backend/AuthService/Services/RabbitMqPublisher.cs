using RabbitMQ.Client;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace AuthService.Services;

public interface IRabbitMqPublisher
{
    Task PublishAsync<T>(string queueName, T message);
}

public class RabbitMqPublisher : IRabbitMqPublisher, IDisposable
{
    private readonly IConfiguration _config;
    private readonly IConnection? _connection;
    private readonly IModel? _channel;
    private readonly ILogger<RabbitMqPublisher> _logger;
    private readonly object _lock = new();

    public RabbitMqPublisher(IConfiguration config, ILogger<RabbitMqPublisher> logger)
    {
        _config = config;
        _logger = logger;

        try
        {
            var factory = new ConnectionFactory
            {
                HostName = config["RabbitMQ:Host"] ?? "localhost",
                Port = int.Parse(config["RabbitMQ:Port"] ?? "5672"),
                UserName = config["RabbitMQ:User"] ?? "guest",
                Password = config["RabbitMQ:Pass"] ?? "guest",
                DispatchConsumersAsync = true
            };

            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();
            _logger.LogInformation("RabbitMQ connected.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning("RabbitMQ unavailable: {msg}", ex.Message);
        }
    }

    public async Task PublishAsync<T>(string queueName, T message)
    {
        if (_channel == null)
        {
            _logger.LogWarning("RabbitMQ channel is null. Message not sent.");
            if (queueName == "notifications")
                _ = Task.Run(() => PublishNotificationFallbackAsync(message));
            return;
        }

        try
        {
            _channel.QueueDeclare(
                queue: queueName,
                durable: true,
                exclusive: false,
                autoDelete: false);

            var eventWrapper = new
            {
                Id = Guid.NewGuid(),
                CreatedAtUtc = DateTime.UtcNow,
                EventType = queueName,
                Payload = message,
                CorrelationId = Guid.NewGuid()
            };

            var json = JsonSerializer.Serialize(eventWrapper);
            var body = Encoding.UTF8.GetBytes(json);

            var props = _channel.CreateBasicProperties();
            props.Persistent = true;
            props.MessageId = eventWrapper.Id.ToString();
            props.CorrelationId = eventWrapper.CorrelationId.ToString();
            props.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds());

            var retry = 3;

            while (retry > 0)
            {
                try
                {
                    lock (_lock)
                    {
                        _channel.BasicPublish(
                            exchange: "",
                            routingKey: queueName,
                            basicProperties: props,
                            body: body);
                    }

                    _logger.LogInformation("Published to {queue}", queueName);
                    break;
                }
                catch (Exception ex)
                {
                    retry--;
                    _logger.LogWarning(
                        "Retrying publish... attempts left: {retry}, error: {msg}",
                        retry,
                        ex.Message);

                    await Task.Delay(200);
                }
            }

            if (retry == 0)
            {
                _logger.LogError("Failed to publish message to {queue} after retries", queueName);
                if (queueName == "notifications")
                    _ = Task.Run(() => PublishNotificationFallbackAsync(message));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError("RabbitMQ publish failed: {msg}", ex.Message);
            if (queueName == "notifications")
                _ = Task.Run(() => PublishNotificationFallbackAsync(message));
        }
    }

    private async Task PublishNotificationFallbackAsync<T>(T message)
    {
        try
        {
            var baseUrl = _config["NotificationService:BaseUrl"] ?? "http://localhost:5125";
            using var http = new HttpClient { BaseAddress = new Uri(baseUrl) };
            http.DefaultRequestHeaders.Add(
                "X-Internal-Api-Key",
                _config["InternalApiKey"] ?? "TrunqoInternalKey");

            var response = await http.PostAsJsonAsync("/api/notifications/internal/create", message);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("Notification fallback failed with status {status}", response.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Notification fallback publish failed: {msg}", ex.Message);
        }
    }

    public void Dispose()
    {
        try
        {
            _channel?.Close();
            _connection?.Close();
        }
        catch
        {
        }

        _channel?.Dispose();
        _connection?.Dispose();
    }
}
