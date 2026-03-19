using MongoDB.Driver;
using NotificationService.DTOs;
using NotificationService.Models;

namespace NotificationService.Services;

public interface INotificationService
{
    Task SaveAsync(Notification notification);
    Task<ApiResponse<List<NotificationResponse>>> GetUserNotificationsAsync(string userId);
    Task<ApiResponse<object>> MarkAsReadAsync(Guid id);
}

public class NotificationService : INotificationService
{
    private readonly IMongoCollection<Notification> _collection;

    public NotificationService(IConfiguration config)
    {
        // Connect to MongoDB Atlas
        var client = new MongoClient(config["MongoDB:ConnectionString"]);
        var database = client.GetDatabase(config["MongoDB:DatabaseName"]);

        // Get or create the "notifications" collection
        // MongoDB creates it automatically if it doesn't exist
        _collection = database.GetCollection<Notification>("notifications");
    }

    // ── SAVE NOTIFICATION ─────────────────────────────────────────────────
    // Called by the RabbitMQ consumer when an event arrives
    public async Task SaveAsync(Notification notification)
    {
        await _collection.InsertOneAsync(notification);
    }

    // ── GET USER NOTIFICATIONS ────────────────────────────────────────────
    public async Task<ApiResponse<List<NotificationResponse>>> GetUserNotificationsAsync(
        string userId)
    {
        // Find all notifications for this user, newest first
        var notifications = await _collection
            .Find(n => n.UserId == userId)
            .SortByDescending(n => n.CreatedAt)
            .Limit(50)
            .ToListAsync();

        var result = notifications.Select(n => new NotificationResponse(
            n.Id, n.UserId, n.Title, n.Message,
            n.Type, n.IsRead, n.CreatedAt
        )).ToList();

        return new ApiResponse<List<NotificationResponse>>(true, "OK", result);
    }

    // ── MARK AS READ ──────────────────────────────────────────────────────
    public async Task<ApiResponse<object>> MarkAsReadAsync(Guid id)
    {
        // UpdateOne finds a document and updates just one field
        var filter = Builders<Notification>.Filter.Eq(n => n.Id, id);
        var update = Builders<Notification>.Update.Set(n => n.IsRead, true);

        var result = await _collection.UpdateOneAsync(filter, update);

        if (result.MatchedCount == 0)
            return new ApiResponse<object>(false, "Notification not found.", null);

        return new ApiResponse<object>(true, "Marked as read.", null);
    }
}