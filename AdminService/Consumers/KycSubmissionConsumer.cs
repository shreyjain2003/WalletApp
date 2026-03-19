using AdminService.Data;
using AdminService.Models;
using Microsoft.EntityFrameworkCore;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

namespace AdminService.Consumers;

public class KycSubmissionConsumer : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly IConfiguration _config;
    private readonly ILogger<KycSubmissionConsumer> _logger;
    private IConnection? _connection;
    private RabbitMQ.Client.IModel? _channel;

    public KycSubmissionConsumer(IServiceProvider services,
                                 IConfiguration config,
                                 ILogger<KycSubmissionConsumer> logger)
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

            // Listen to kyc_submissions queue
            _channel.QueueDeclare(
                queue: "kyc_submissions",
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
                    var message = JsonSerializer.Deserialize<KycSubmissionEvent>(
                        json, new JsonSerializerOptions
                        { PropertyNameCaseInsensitive = true });

                    if (message != null)
                    {
                        using var scope = _services.CreateScope();
                        var db = scope.ServiceProvider
                            .GetRequiredService<AdminDbContext>();

                        // Check if KYC review already exists for this user
                        var existing = await db.KycReviews
                            .FirstOrDefaultAsync(k => k.UserId == message.UserId);

                        if (existing != null)
                        {
                            // Update existing record
                            existing.DocumentType = message.DocumentType;
                            existing.DocumentNumber = message.DocumentNumber;
                            existing.Status = "Pending";
                            existing.AdminNote = null;
                            existing.ReviewedBy = null;
                            existing.ReviewedAt = null;
                            existing.SubmittedAt = message.SubmittedAt;
                        }
                        else
                        {
                            // Create new KYC review
                            var review = new KycReview
                            {
                                Id = Guid.NewGuid(),
                                UserId = message.UserId,
                                UserFullName = message.FullName,
                                UserEmail = message.Email,
                                DocumentType = message.DocumentType,
                                DocumentNumber = message.DocumentNumber,
                                Status = "Pending",
                                SubmittedAt = message.SubmittedAt
                            };
                            db.KycReviews.Add(review);
                        }

                        await db.SaveChangesAsync();

                        _logger.LogInformation(
                            "KYC synced for user {userId}", message.UserId);
                    }

                    _channel.BasicAck(ea.DeliveryTag, false);
                }
                catch (Exception ex)
                {
                    _logger.LogError("Failed to process KYC submission: {msg}", ex.Message);
                    _channel.BasicNack(ea.DeliveryTag, false, true);
                }
            };

            _channel.BasicConsume(
                queue: "kyc_submissions",
                autoAck: false,
                consumer: consumer);

            _logger.LogInformation("KycSubmissionConsumer started.");
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

public record KycSubmissionEvent(
    Guid UserId,
    string FullName,
    string Email,
    string DocumentType,
    string DocumentNumber,
    DateTime SubmittedAt
);