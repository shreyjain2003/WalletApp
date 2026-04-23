using AuthService.Data;
using AuthService.Middleware;
using AuthService.Repositories;
using AuthService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ── 1. Database ────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

// ── 2. Register Services for Dependency Injection ─────────────────────────
// Scoped = one instance created per HTTP request, destroyed after
builder.Services.AddScoped<IAuthService, AuthService.Services.AuthService>();
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<ITransactionPinRepository, TransactionPinRepository>();
builder.Services.AddScoped<ITokenService, TokenService>();
// Singleton = created once, reused for entire app lifetime
// Good for connections like RabbitMQ
builder.Services.AddSingleton<IRabbitMqPublisher, RabbitMqPublisher>();
// Add KYC Decision Consumer
builder.Services.AddHostedService<AuthService.Consumers.KycDecisionConsumer>();

// ── 3. JWT Authentication ──────────────────────────────────────────────────
// This reads every incoming request for "Authorization: Bearer eyJ..."
// and validates the token automatically before hitting your controller
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,  // rejects expired tokens
            ValidateIssuerSigningKey = true,  // verifies the signature
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState.Values
            .SelectMany(v => v.Errors)
            .Select(e => e.ErrorMessage)
            .Where(message => !string.IsNullOrWhiteSpace(message))
            .ToList();

        var message = errors.Count > 0
            ? string.Join(" ", errors)
            : "Validation failed.";

        return new BadRequestObjectResult(
            new AuthService.DTOs.ApiResponse<object>(false, message, null));
    };
});

// ── 4. Swagger with JWT support ────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "AuthService", Version = "v1" });

    // Adds the Authorize button in Swagger UI
    // so we can test protected endpoints easily
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

// ── Ensure TransactionPins table exists (created outside EF migrations) ───
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
    try
    {
        await db.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_NAME = 'TransactionPins'
            )
            BEGIN
                CREATE TABLE [TransactionPins] (
                    [UserId]    UNIQUEIDENTIFIER NOT NULL,
                    [PinHash]   NVARCHAR(200)    NOT NULL,
                    [CreatedAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                    [UpdatedAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                    CONSTRAINT [PK_TransactionPins] PRIMARY KEY ([UserId]),
                    CONSTRAINT [FK_TransactionPin_User] FOREIGN KEY ([UserId])
                        REFERENCES [Users] ([Id]) ON DELETE CASCADE
                );
            END
        ");

        // Branding migration: keep existing databases compatible after WalletApp -> Trunqo rename.
        await db.Database.ExecuteSqlRawAsync(@"
            UPDATE [Users]
            SET [Email] = 'admin@trunqo.com'
            WHERE [Role] = 'Admin'
              AND LOWER([Email]) = 'admin@walletapp.com'
        ");
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Failed to ensure TransactionPins table exists.");
    }
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Order matters — Authentication must come before Authorization
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
