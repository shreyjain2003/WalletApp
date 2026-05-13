// ============================================================
// RabbitMqPublisher.cs — AuthService
// ------------------------------------------------------------
// Singleton service that publishes messages to RabbitMQ queues.
// Registered as a Singleton in Program.cs so one connection is
// shared for the entire application lifetime (connections are
// expensive to open — reusing them is the correct pattern).
//
// Queues used by AuthService:
//   "notifications" — welcome messages and OTP emails
//   "kyc_submissions" — KYC document submissions for AdminService
//
// Resilience features:
//   - If RabbitMQ is unavailable at startup, the publisher degrades
//     gracefully (logs a warning, channel stays null).
//   - PublishAsync retries up to 3 times with 200ms delay on failure.
//   - If all retries fail for a "notifications" message, falls back to
//     a direct HTTP POST to NotificationService's internal endpoint.
//   - A lock object (_lock) serializes channel.BasicPublish calls
//     because IModel is not thread-safe.
//
// Message format: every message is wrapped in an EventWrapper envelope
// with Id, CreatedAtUtc, EventType, Payload, and CorrelationId fields
// for traceability and idempotency.
// ============================================================

using RabbitMQ.Client;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace AuthService.Services;

// Interface allows unit tests to inject a FakeAuthPublisher that records
// published messages without needing a real RabbitMQ instance.
public interface IRabbitMqPublisher
{
    Task PublishAsync<T>(string queueName, T message);
}

// IDisposable: the connection and channel are closed when the app shuts down.
public class RabbitMqPublisher : IRabbitMqPublisher, IDisposable
{
    private readonly IConfiguration _config;
    private readonly IConnection? _connection;  // TCP connection to RabbitMQ broker
    private readonly IModel? _channel;          // AMQP channel (lightweight, multiplexed over connection)
    private readonly ILogger<RabbitMqPublisher> _logger;

    // _lock serializes BasicPublish calls — IModel is not thread-safe.
    private readonly object _lock = new();

    public RabbitMqPublisher(IConfiguration config, ILogger<RabbitMqPublisher> logger)
    {
        _config = config;
        _logger = logger;

        try
        {
            // Build the connection factory from appsettings.json RabbitMQ section.
            var factory = new ConnectionFactory
            {
                HostName = config["RabbitMQ:Host"] ?? "localhost",
                Port = int.Parse(config["RabbitMQ:Port"] ?? "5672"),
                UserName = config["RabbitMQ:User"] ?? "guest",
                Password = config["RabbitMQ:Pass"] ?? "guest",
                // DispatchConsumersAsync = true allows async consumer callbacks
                // (not used in the publisher but required for consistency with consumers).
                DispatchConsumersAsync = true
            };

            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();
            _logger.LogInformation("RabbitMQ connected.");
        }
        catch (Exception ex)
        {
            // RabbitMQ is optional at startup — the app continues without it.
            // The fallback HTTP path handles notifications if RabbitMQ is down.
            _logger.LogWarning("RabbitMQ unavailable: {msg}", ex.Message);
        }
    }

    // ── PublishAsync ─────────────────────────────────────────────────────────
    // Publishes a message to the specified queue with up to 3 retry attempts.
    // Messages are wrapped in an EventWrapper envelope for traceability.
    // Persistent = true ensures messages survive a RabbitMQ broker restart.
    public async Task PublishAsync<T>(string queueName, T message)
    {
        if (_channel == null)
        {
            // Channel is null when RabbitMQ was unavailable at startup.
            _logger.LogWarning("RabbitMQ channel is null. Message not sent.");
            // Fall back to HTTP for notification messages so they are not lost.
            if (queueName == "notifications")
                _ = Task.Run(() => PublishNotificationFallbackAsync(message));
            return;
        }

        try
        {
            // Declare the queue idempotently — safe to call even if it already exists.
            // durable: true — queue survives broker restart.
            // exclusive: false — multiple consumers can connect.
            // autoDelete: false — queue persists when all consumers disconnect.
            _channel.QueueDeclare(
                queue: queueName,
                durable: true,
                exclusive: false,
                autoDelete: false);

            // Wrap the payload in an envelope with metadata for traceability.
            var eventWrapper = new
            {
                Id = Guid.NewGuid(),              // unique message ID
                CreatedAtUtc = DateTime.UtcNow,   // when the event was created
                EventType = queueName,            // which queue/event type this is
                Payload = message,                // the actual data
                CorrelationId = Guid.NewGuid()    // for distributed tracing
            };

            var json = JsonSerializer.Serialize(eventWrapper);
            var body = Encoding.UTF8.GetBytes(json);

            // Set AMQP message properties.
            var props = _channel.CreateBasicProperties();
            props.Persistent = true;                              // survive broker restart
            props.MessageId = eventWrapper.Id.ToString();
            props.CorrelationId = eventWrapper.CorrelationId.ToString();
            props.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds());

            var retry = 3; // maximum publish attempts

            while (retry > 0)
            {
                try
                {
                    // Lock because IModel.BasicPublish is not thread-safe.
                    lock (_lock)
                    {
                        _channel.BasicPublish(
                            exchange: "",          // default exchange — routes by queue name
                            routingKey: queueName,
                            basicProperties: props,
                            body: body);
                    }

                    _logger.LogInformation("Published to {queue}", queueName);
                    break; // success — exit retry loop
                }
                catch (Exception ex)
                {
                    retry--;
                    _logger.LogWarning(
                        "Retrying publish... attempts left: {retry}, error: {msg}",
                        retry,
                        ex.Message);

                    // Brief pause before retrying to allow transient issues to resolve.
                    await Task.Delay(200);
                }
            }

            if (retry == 0)
            {
                _logger.LogError("Failed to publish message to {queue} after retries", queueName);
                // Last-resort fallback for notification messages.
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

    // ── PublishNotificationFallbackAsync ─────────────────────────────────────
    // HTTP fallback for notification messages when RabbitMQ is unavailable.
    // Calls NotificationService's internal endpoint directly so notifications
    // are not silently dropped when the message broker is down.
    // Runs in a fire-and-forget Task.Run so it does not block the caller.
    private async Task PublishNotificationFallbackAsync<T>(T message)
    {
        try
        {
            var baseUrl = _config["NotificationService:BaseUrl"] ?? "http://localhost:5125";
            using var http = new HttpClient { BaseAddress = new Uri(baseUrl) };

            // Authenticate the internal call with the shared API key.
            http.DefaultRequestHeaders.Add(
                "X-Internal-Api-Key",
                _config["InternalApiKey"] ?? "TrunqoInternalKey2024");

            var response = await http.PostAsJsonAsync("/api/notifications/internal/create", message);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("Notification fallback failed with status {status}", response.StatusCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Notification fallback publish failed: {msg}", ex.Message);
        }
    }

    // ── Dispose ──────────────────────────────────────────────────────────────
    // Gracefully closes the AMQP channel and TCP connection when the app shuts down.
    // Called automatically by the DI container because this class is registered
    // as a Singleton that implements IDisposable.
    public void Dispose()
    {
        try
        {
            _channel?.Close();
            _connection?.Close();
        }
        catch
        {
            // Ignore errors during shutdown — the process is exiting anyway.
        }

        _channel?.Dispose();
        _connection?.Dispose();
    }
}
