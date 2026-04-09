using AdminService.Models;
using AdminService.Repositories;
using AuthService.DTOs;
using AuthService.Models;
using AuthService.Repositories;
using AuthService.Services;
using Microsoft.Extensions.Configuration;
using WalletService.DTOs;
using WalletService.Models;
using WalletService.Repositories;

var tests = new List<(string Name, Action Run)>
{
    ("Auth register normalizes and publishes welcome notification", AuthRegisterNormalizesAndPublishesWelcome),
    ("Auth register rejects duplicate email", AuthRegisterRejectsDuplicateEmail),
    ("Auth update rejects duplicate phone number", AuthUpdateRejectsDuplicatePhone),
    ("Wallet get-or-create creates a new wallet", WalletGetOrCreateCreatesWallet),
    ("Wallet adjust creates an admin adjustment transaction", WalletAdjustCreatesTransaction),
    ("Wallet CSV export returns transaction rows", WalletCsvExportIncludesTransactions),
    ("Admin pending KYC maps review records", AdminPendingKycMapsReviews)
};

var failures = new List<string>();

foreach (var (name, run) in tests)
{
    try
    {
        run();
        Console.WriteLine($"[PASS] {name}");
    }
    catch (Exception ex)
    {
        failures.Add($"{name}: {ex.Message}");
        Console.WriteLine($"[FAIL] {name}");
    }
}

if (failures.Count > 0)
{
    Console.WriteLine();
    Console.WriteLine("Failures:");
    foreach (var failure in failures)
        Console.WriteLine($" - {failure}");

    Environment.ExitCode = 1;
}
else
{
    Console.WriteLine();
    Console.WriteLine($"All {tests.Count} service tests passed.");
}

static void AuthRegisterNormalizesAndPublishesWelcome()
{
    var repo = new FakeAuthRepository();
    var tokens = new FakeTokenService();
    var mq = new FakeAuthPublisher();
    var service = new AuthService.Services.AuthService(repo, tokens, mq);

    var result = service.RegisterAsync(new RegisterRequest(
        "  Test User  ",
        "  TEST@Example.com ",
        " 9876543210 ",
        "Password@123")).GetAwaiter().GetResult();

    AssertTrue(result.Success, "register should succeed");
    AssertEqual("token-123", result.Data?.Token, "token should come from token service");
    AssertEqual("test@example.com", repo.Users.Single().Email, "email should be normalized");
    AssertEqual("9876543210", repo.Users.Single().PhoneNumber, "phone should be trimmed");
    AssertEqual("Test User", repo.Users.Single().FullName, "full name should be trimmed");
    AssertEqual("notifications", mq.Published.Single().Queue, "welcome notification should be published");
}

static void AuthRegisterRejectsDuplicateEmail()
{
    var repo = new FakeAuthRepository();
    repo.Users.Add(new User
    {
        Id = Guid.NewGuid(),
        Email = "dupe@example.com",
        PhoneNumber = "9876543210",
        FullName = "Existing User",
        PasswordHash = "hash",
        Role = "User",
        Status = "Pending",
        CreatedAt = DateTime.UtcNow
    });

    var service = new AuthService.Services.AuthService(repo, new FakeTokenService(), new FakeAuthPublisher());
    var result = service.RegisterAsync(new RegisterRequest(
        "Another User",
        "DUPE@example.com",
        "9123456789",
        "Password@123")).GetAwaiter().GetResult();

    AssertTrue(!result.Success, "duplicate email should fail");
    AssertEqual(1, repo.Users.Count, "no new user should be created");
}

static void AuthUpdateRejectsDuplicatePhone()
{
    var targetId = Guid.NewGuid();
    var repo = new FakeAuthRepository();
    repo.Users.Add(new User
    {
        Id = targetId,
        Email = "one@example.com",
        PhoneNumber = "9876543210",
        FullName = "User One",
        PasswordHash = "hash",
        Role = "User",
        Status = "Active",
        CreatedAt = DateTime.UtcNow
    });
    repo.Users.Add(new User
    {
        Id = Guid.NewGuid(),
        Email = "two@example.com",
        PhoneNumber = "9123456789",
        FullName = "User Two",
        PasswordHash = "hash",
        Role = "User",
        Status = "Active",
        CreatedAt = DateTime.UtcNow
    });

    var service = new AuthService.Services.AuthService(repo, new FakeTokenService(), new FakeAuthPublisher());
    var result = service.UpdateUserAsync(targetId, new UpdateUserRequest(
        "User One Updated",
        "one.updated@example.com",
        "9123456789")).GetAwaiter().GetResult();

    AssertTrue(!result.Success, "duplicate phone should fail");
}

static void WalletGetOrCreateCreatesWallet()
{
    var repo = new FakeWalletRepository();
    var service = new WalletService.Services.WalletService(repo, new FakeWalletPublisher(), BuildConfig());

    var userId = Guid.NewGuid();
    var result = service.GetOrCreateWalletAsync(userId).GetAwaiter().GetResult();

    AssertTrue(result.Success, "wallet should be created");
    AssertEqual(1, repo.Wallets.Count, "wallet should be stored");
    AssertEqual("INR", repo.Wallets.Single().Currency, "currency should default to INR");
}

static void WalletAdjustCreatesTransaction()
{
    var userId = Guid.NewGuid();
    var walletId = Guid.NewGuid();
    var repo = new FakeWalletRepository();
    repo.Wallets.Add(new Wallet
    {
        Id = walletId,
        UserId = userId,
        Balance = 250,
        Currency = "INR",
        IsLocked = false,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    });

    var service = new WalletService.Services.WalletService(repo, new FakeWalletPublisher(), BuildConfig());
    var result = service.AdjustWalletAsync(new AdjustWalletRequest(userId, 500, "manual correction"))
        .GetAwaiter().GetResult();

    AssertTrue(result.Success, "wallet adjustment should succeed");
    AssertEqual(500m, repo.Wallets.Single().Balance, "wallet balance should update");
    AssertEqual("admin_adjustment", repo.Transactions.Single().Type, "adjustment transaction should be recorded");
}

static void WalletCsvExportIncludesTransactions()
{
    var userId = Guid.NewGuid();
    var walletId = Guid.NewGuid();
    var repo = new FakeWalletRepository();
    repo.Wallets.Add(new Wallet
    {
        Id = walletId,
        UserId = userId,
        Balance = 1000,
        Currency = "INR",
        IsLocked = false,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    });
    repo.Transactions.Add(new WalletTransaction
    {
        Id = Guid.NewGuid(),
        WalletId = walletId,
        Type = "topup",
        Amount = 1000,
        BalanceAfter = 1000,
        Status = "Success",
        Reference = "TP-1",
        Note = "initial",
        CreatedAt = DateTime.UtcNow
    });

    var service = new WalletService.Services.WalletService(repo, new FakeWalletPublisher(), BuildConfig());
    var file = service.ExportHistoryCsvAsync(userId).GetAwaiter().GetResult();
    var csv = System.Text.Encoding.UTF8.GetString(file!.Content);

    AssertTrue(csv.Contains("Id,Type,Amount"), "csv should contain header row");
    AssertTrue(csv.Contains("TP-1"), "csv should contain transaction reference");
}

static void AdminPendingKycMapsReviews()
{
    var repo = new FakeAdminRepository();
    repo.KycReviews.Add(new KycReview
    {
        Id = Guid.NewGuid(),
        UserId = Guid.NewGuid(),
        UserFullName = "Pending User",
        UserEmail = "pending@example.com",
        DocumentType = "passport",
        DocumentNumber = "ABC1234",
        Status = "Pending",
        SubmittedAt = DateTime.UtcNow
    });

    var service = new AdminService.Services.AdminService(repo, BuildConfig(), new FakeAdminPublisher(), null!);
    var result = service.GetPendingKycAsync().GetAwaiter().GetResult();

    AssertTrue(result.Success, "pending KYC query should succeed");
    AssertEqual(1, result.Data?.Count ?? 0, "one review should be returned");
    AssertEqual("Pending User", result.Data?.Single().UserFullName, "review should map user name");
}

static IConfiguration BuildConfig() =>
    new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AuthService:BaseUrl"] = "https://localhost:7264",
            ["InternalApiKey"] = "WalletAppInternalKey"
        })
        .Build();

static void AssertTrue(bool condition, string message)
{
    if (!condition)
        throw new InvalidOperationException(message);
}

static void AssertEqual<T>(T expected, T actual, string message)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
        throw new InvalidOperationException($"{message}. Expected '{expected}' but got '{actual}'.");
}

file sealed class FakeTokenService : ITokenService
{
    public string GenerateToken(User user) => "token-123";
}

file sealed class FakeAuthPublisher : AuthService.Services.IRabbitMqPublisher
{
    public List<(string Queue, object Message)> Published { get; } = new();
    public void Publish<T>(string queueName, T message) => Published.Add((queueName, message!));
}

file sealed class FakeWalletPublisher : WalletService.Services.IRabbitMqPublisher
{
    public List<(string Queue, object Message)> Published { get; } = new();
    public void Publish<T>(string queueName, T message) => Published.Add((queueName, message!));
}

file sealed class FakeAdminPublisher : AdminService.Services.IRabbitMqPublisher
{
    public List<(string Queue, object Message)> Published { get; } = new();
    public void Publish<T>(string queueName, T message) => Published.Add((queueName, message!));
}

file sealed class FakeAuthRepository : IAuthRepository
{
    public List<User> Users { get; } = new();
    public List<KycDocument> KycDocuments { get; } = new();

    public Task<bool> EmailExistsAsync(string email, Guid? excludeUserId = null) =>
        Task.FromResult(Users.Any(u => u.Email == email && (!excludeUserId.HasValue || u.Id != excludeUserId.Value)));

    public Task<bool> PhoneExistsAsync(string phoneNumber, Guid? excludeUserId = null) =>
        Task.FromResult(Users.Any(u => u.PhoneNumber == phoneNumber && (!excludeUserId.HasValue || u.Id != excludeUserId.Value)));

    public Task<User?> GetUserByIdAsync(Guid userId, bool includeKyc = false) =>
        Task.FromResult(Users.FirstOrDefault(u => u.Id == userId));

    public Task<User?> GetUserByEmailAsync(string email, bool includeKyc = false) =>
        Task.FromResult(Users.FirstOrDefault(u => u.Email == email));

    public Task<List<User>> GetUsersByRoleAsync(string role, bool includeKyc = false) =>
        Task.FromResult(Users.Where(u => u.Role == role).OrderByDescending(u => u.CreatedAt).ToList());

    public Task AddUserAsync(User user)
    {
        Users.Add(user);
        return Task.CompletedTask;
    }

    public Task AddKycDocumentAsync(KycDocument document)
    {
        KycDocuments.Add(document);
        var user = Users.FirstOrDefault(u => u.Id == document.UserId);
        if (user != null)
            user.KycDocument = document;
        return Task.CompletedTask;
    }

    public void RemoveKycDocument(KycDocument document)
    {
        KycDocuments.Remove(document);
        var user = Users.FirstOrDefault(u => u.Id == document.UserId);
        if (user != null && user.KycDocument?.Id == document.Id)
            user.KycDocument = null;
    }

    public void RemoveUser(User user) => Users.Remove(user);

    public Task<int> SaveChangesAsync() => Task.FromResult(1);
}

file sealed class FakeWalletRepository : IWalletRepository
{
    public List<Wallet> Wallets { get; } = new();
    public List<WalletTransaction> Transactions { get; } = new();

    public Task<Wallet?> GetWalletByUserIdAsync(Guid userId) =>
        Task.FromResult(Wallets.FirstOrDefault(w => w.UserId == userId));

    public Task<Wallet?> GetWalletByIdAsync(Guid walletId) =>
        Task.FromResult(Wallets.FirstOrDefault(w => w.Id == walletId));

    public Task AddWalletAsync(Wallet wallet)
    {
        Wallets.Add(wallet);
        return Task.CompletedTask;
    }

    public Task<List<WalletTransaction>> GetTransactionsForWalletAsync(Guid walletId, int take = 50) =>
        Task.FromResult(Transactions.Where(t => t.WalletId == walletId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(take)
            .ToList());

    public Task AddTransactionAsync(WalletTransaction transaction)
    {
        Transactions.Add(transaction);
        return Task.CompletedTask;
    }

    public Task AddTransactionsAsync(params WalletTransaction[] transactions)
    {
        Transactions.AddRange(transactions);
        return Task.CompletedTask;
    }

    public Task<int> SaveChangesAsync() => Task.FromResult(1);
}

file sealed class FakeAdminRepository : IAdminRepository
{
    public List<KycReview> KycReviews { get; } = new();
    public List<AdminService.Models.SupportTicket> Tickets { get; } = new();

    public Task<KycReview?> GetKycReviewByIdAsync(Guid id) =>
        Task.FromResult(KycReviews.FirstOrDefault(k => k.Id == id));

    public Task<KycReview?> GetKycReviewByUserIdAsync(Guid userId) =>
        Task.FromResult(KycReviews.FirstOrDefault(k => k.UserId == userId));

    public Task<List<KycReview>> GetPendingKycReviewsAsync() =>
        Task.FromResult(KycReviews.Where(k => k.Status == "Pending")
            .OrderBy(k => k.SubmittedAt)
            .ToList());

    public Task<List<AdminService.Models.SupportTicket>> GetAllTicketsAsync() =>
        Task.FromResult(Tickets.OrderByDescending(t => t.CreatedAt).ToList());

    public Task<List<AdminService.Models.SupportTicket>> GetTicketsByUserIdAsync(Guid userId) =>
        Task.FromResult(Tickets.Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToList());

    public Task<AdminService.Models.SupportTicket?> GetTicketByIdAsync(Guid ticketId) =>
        Task.FromResult(Tickets.FirstOrDefault(t => t.Id == ticketId));

    public Task AddKycReviewAsync(KycReview review)
    {
        KycReviews.Add(review);
        return Task.CompletedTask;
    }

    public Task AddTicketAsync(AdminService.Models.SupportTicket ticket)
    {
        Tickets.Add(ticket);
        return Task.CompletedTask;
    }

    public Task<int> SaveChangesAsync() => Task.FromResult(1);
}
