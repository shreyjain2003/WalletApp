using AdminService.Data;
using AdminService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ── 1. Database ────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AdminDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

// ── 2. HttpClient for calling AuthService ─────────────────────────────────
builder.Services.AddHttpClient();

// ── 3. Register Services ───────────────────────────────────────────────────
builder.Services.AddScoped<IAdminService, AdminService.Services.AdminService>();
builder.Services.AddSingleton<IRabbitMqPublisher, RabbitMqPublisher>();

// Add KYC Submission Consumer
builder.Services.AddHostedService<AdminService.Consumers.KycSubmissionConsumer>();

// ── 4. JWT Authentication ──────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();

// ── 5. Swagger with JWT ────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {your token}"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
// ── Sync missing KYC records on startup ───────────────────────────────
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        using var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };
        using var http = new HttpClient(handler);
        http.BaseAddress = new Uri(config["AuthService:BaseUrl"]!);

        var response = await http.GetAsync("/api/auth/internal/users");
        if (response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync();
            var users = System.Text.Json.JsonSerializer.Deserialize<AuthUsersResponse>(
                json, new System.Text.Json.JsonSerializerOptions
                { PropertyNameCaseInsensitive = true });

            if (users?.Data != null)
            {
                foreach (var user in users.Data)
                {
                    if (user.Kyc == null) continue;

                    // Check if already in admin DB
                    var exists = await db.KycReviews
                        .AnyAsync(k => k.UserId == user.UserId);

                    if (!exists)
                    {
                        db.KycReviews.Add(new AdminService.Models.KycReview
                        {
                            Id = Guid.NewGuid(),
                            UserId = user.UserId,
                            UserFullName = user.FullName,
                            UserEmail = user.Email,
                            DocumentType = user.Kyc.DocumentType,
                            DocumentNumber = user.Kyc.DocumentNumber,
                            Status = user.Kyc.Status,
                            SubmittedAt = user.Kyc.SubmittedAt
                        });
                    }
                }
                await db.SaveChangesAsync();
            }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"KYC sync warning: {ex.Message}");
    }
}

app.Run();
// Helper records for KYC sync
public record AuthUsersResponse(bool Success, string Message, List<UserProfileData>? Data);
public record UserProfileData(
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string Status,
    string Role,
    KycData? Kyc
);
public record KycData(
    Guid Id,
    string DocumentType,
    string DocumentNumber,
    string Status,
    string? AdminNote,
    DateTime SubmittedAt,
    DateTime? ReviewedAt
);