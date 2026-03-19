using Ocelot.DependencyInjection;
using Ocelot.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Load ocelot.json config file
builder.Configuration.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);

// Add CORS — needed for Angular frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Register Ocelot
builder.Services.AddOcelot(builder.Configuration);

var app = builder.Build();

// Use CORS before Ocelot
app.UseCors("AllowAngular");

// Ocelot handles all routing
await app.UseOcelot();

app.Run();