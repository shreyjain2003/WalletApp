using RabbitMQ.Client;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace AdminService.Services;

public interface IRabbitMqPublisher
{
    void Publish<T>(string queueName, T message);
}

public class RabbitMqPublisher : IRabbitMqPublisher, IDisposable
{
    private readonly IConfiguration _config;
    private readonly IConnection? _connection;
    private readonly IModel? _channel;
    private readonly ILogger<RabbitMqPublisher> _logger;

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
                Password = config["RabbitMQ:Pass"] ?? "guest"
            };
            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();
            _logger.LogInformation("RabbitMQ connected.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning("RabbitMQ unavailable: {msg}", ex.Message);
            _connection = null;
            _channel = null;
        }
    }

    public void Publish<T>(string queueName, T message)
    {
        if (_channel == null)
        {
            if (queueName == "notifications")
                _ = Task.Run(() => PublishNotificationFallbackAsync(message));
            return;
        }

        try
        {
            _channel.QueueDeclare(queueName, durable: true, exclusive: false, autoDelete: false);
            var json = JsonSerializer.Serialize(message);
            var body = Encoding.UTF8.GetBytes(json);
            var props = _channel.CreateBasicProperties();
            props.Persistent = true;
            _channel.BasicPublish("", queueName, props, body);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Publish failed: {msg}", ex.Message);
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
        _channel?.Dispose();
        _connection?.Dispose();
    }
}
