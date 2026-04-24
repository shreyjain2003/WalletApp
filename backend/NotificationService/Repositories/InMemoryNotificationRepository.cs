using NotificationService.Models;

namespace NotificationService.Repositories;

public class InMemoryNotificationRepository : INotificationRepository
{
    private static readonly List<Notification> Store = new();
    private static readonly object Sync = new();

    public Task SaveAsync(Notification notification)
    {
        lock (Sync)
        {
            Store.Add(notification);
        }
        return Task.CompletedTask;
    }

    public Task<List<Notification>> GetUserNotificationsAsync(string userId, int take = 50)
    {
        lock (Sync)
        {
            var items = Store
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(take)
                .ToList();
            return Task.FromResult(items);
        }
    }

    public Task<bool> MarkAsReadAsync(Guid id)
    {
        lock (Sync)
        {
            var item = Store.FirstOrDefault(n => n.Id == id);
            if (item == null)
            {
                return Task.FromResult(false);
            }

            item.IsRead = true;
            return Task.FromResult(true);
        }
    }
}
