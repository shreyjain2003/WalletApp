using MongoDB.Driver;
using NotificationService.Models;

namespace NotificationService.Repositories;

public interface INotificationRepository
{
    Task SaveAsync(Notification notification);
    Task<List<Notification>> GetUserNotificationsAsync(string userId, int take = 50);
    Task<bool> MarkAsReadAsync(Guid id);
}

public class NotificationRepository : INotificationRepository
{
    private readonly IMongoCollection<Notification> _collection;

    public NotificationRepository(IConfiguration config)
    {
        var client = new MongoClient(config["MongoDB:ConnectionString"]);
        var database = client.GetDatabase(config["MongoDB:DatabaseName"]);
        _collection = database.GetCollection<Notification>("notifications");
    }

    public Task SaveAsync(Notification notification) => _collection.InsertOneAsync(notification);

    public Task<List<Notification>> GetUserNotificationsAsync(string userId, int take = 50) =>
        _collection.Find(n => n.UserId == userId)
            .SortByDescending(n => n.CreatedAt)
            .Limit(take)
            .ToListAsync();

    public async Task<bool> MarkAsReadAsync(Guid id)
    {
        var filter = Builders<Notification>.Filter.Eq(n => n.Id, id);
        var update = Builders<Notification>.Update.Set(n => n.IsRead, true);
        var result = await _collection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }
}
