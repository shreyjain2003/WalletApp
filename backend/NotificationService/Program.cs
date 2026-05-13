// ============================================================
// Program.cs — NotificationService
// ------------------------------------------------------------
// Application entry point and DI container configuration.
// This file wires together every dependency the service needs:
//   1. MongoDB repository (or in-memory fallback if MongoDB is not configured)
//   2. Scoped NotificationService and EmailNotificationService
//   3. Background NotificationConsumer (listens to "notifications" queue)
//   4. JWT Bearer authentication (same key as AuthService)
//   5. Swagger UI with JWT support
//
// MongoDB fallback:
//   If MongoDB:ConnectionString is missing or starts with "__TRUNQO_" (placeholder),
//   the service falls back to an in-memory repository so it can still run locally
//   without a MongoDB connection. In-memory data is lost on restart.
//
// Middleware pipeline order (ORDER MATTERS):
//   Swagger → ExceptionHandlingMiddleware → Authentication → Authorization → Controllers
// ============================================================

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using NotificationService.Consumers;
using NotificationService.Middleware;
using NotificationService.Repositories;
using NotificationService.Services;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ── 1. Register NotificationService (MongoDB) ──────────────────────────────
builder.Services.AddScoped<INotificationService,
    NotificationService.Services.NotificationService>();
var mongoConnectionString = builder.Configuration["MongoDB:ConnectionString"];
var mongoConfigured = !string.IsNullOrWhiteSpace(mongoConnectionString)
    && !mongoConnectionString.StartsWith("__TRUNQO_", StringComparison.Ordinal);
if (mongoConfigured)
{
    builder.Services.AddScoped<INotificationRepository,
        NotificationService.Repositories.NotificationRepository>();
}
else
{
    builder.Services.AddSingleton<INotificationRepository,
        NotificationService.Repositories.InMemoryNotificationRepository>();
}
builder.Services.AddScoped<IEmailNotificationService,
    NotificationService.Services.EmailNotificationService>();

// ── 2. Register RabbitMQ Consumer as Background Service ───────────────────
// This starts automatically when app starts and listens forever
builder.Services.AddHostedService<NotificationConsumer>();

// ── 3. JWT Authentication ──────────────────────────────────────────────────
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

// ── 4. Swagger with JWT ────────────────────────────────────────────────────
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
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.Run();
