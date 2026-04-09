using AdminService.Data;
using AdminService.Models;
using Microsoft.EntityFrameworkCore;

namespace AdminService.Repositories;

public interface IAdminRepository
{
    Task<KycReview?> GetKycReviewByIdAsync(Guid id);
    Task<KycReview?> GetKycReviewByUserIdAsync(Guid userId);
    Task<List<KycReview>> GetPendingKycReviewsAsync();
    Task<List<SupportTicket>> GetAllTicketsAsync();
    Task<List<SupportTicket>> GetTicketsByUserIdAsync(Guid userId);
    Task<SupportTicket?> GetTicketByIdAsync(Guid id);
    Task AddKycReviewAsync(KycReview review);
    Task AddTicketAsync(SupportTicket ticket);
    Task<int> SaveChangesAsync();
}

public class AdminRepository : IAdminRepository
{
    private readonly AdminDbContext _db;

    public AdminRepository(AdminDbContext db)
    {
        _db = db;
    }

    public Task<KycReview?> GetKycReviewByIdAsync(Guid id) => _db.KycReviews.FindAsync(id).AsTask();

    public Task<KycReview?> GetKycReviewByUserIdAsync(Guid userId) =>
        _db.KycReviews.FirstOrDefaultAsync(k => k.UserId == userId);

    public Task<List<KycReview>> GetPendingKycReviewsAsync() =>
        _db.KycReviews.Where(k => k.Status == "Pending").OrderBy(k => k.SubmittedAt).ToListAsync();

    public Task<List<SupportTicket>> GetAllTicketsAsync() =>
        _db.SupportTickets.OrderByDescending(t => t.CreatedAt).ToListAsync();

    public Task<List<SupportTicket>> GetTicketsByUserIdAsync(Guid userId) =>
        _db.SupportTickets.Where(t => t.UserId == userId).OrderByDescending(t => t.CreatedAt).ToListAsync();

    public Task<SupportTicket?> GetTicketByIdAsync(Guid id) => _db.SupportTickets.FindAsync(id).AsTask();

    public Task AddKycReviewAsync(KycReview review) => _db.KycReviews.AddAsync(review).AsTask();

    public Task AddTicketAsync(SupportTicket ticket) => _db.SupportTickets.AddAsync(ticket).AsTask();

    public Task<int> SaveChangesAsync() => _db.SaveChangesAsync();
}
