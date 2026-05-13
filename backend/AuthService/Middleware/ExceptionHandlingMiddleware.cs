// ExceptionHandlingMiddleware.cs
// Global exception handler that sits in the ASP.NET Core middleware pipeline.
// Without this, any unhandled exception would either return a raw HTML error page
// (in development) or a blank 500 response (in production) — neither of which
// is useful to API clients.
// This middleware catches every exception thrown anywhere in the pipeline,
// logs it at the appropriate severity level, and converts it into a consistent
// JSON error response that matches the ApiResponse<T> shape used everywhere else.

using System.Text.Json;
using AuthService.Common.Exceptions;

namespace AuthService.Middleware;

// Registered in Program.cs via app.UseMiddleware<ExceptionHandlingMiddleware>().
// Must be registered BEFORE UseAuthentication/UseAuthorization so that
// auth-related exceptions are also caught here.
public class ExceptionHandlingMiddleware
{
    // The next middleware in the pipeline — we call it inside a try/catch
    // so we can intercept any exception it (or anything further down) throws.
    private readonly RequestDelegate _next;

    // Structured logger — writes to whatever logging sinks are configured
    // (console, file, Application Insights, etc.).
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    // Constructor — ASP.NET Core's DI container injects these automatically
    // when the middleware is registered.
    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    // Called by the framework for every HTTP request.
    // Wraps the rest of the pipeline in a try/catch so no exception escapes
    // to the framework's default error handler.
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            // Pass control to the next middleware (routing → controller → service → repo).
            // If everything succeeds, execution returns here and we do nothing.
            await _next(context);
        }
        catch (AppException ex)
        {
            // AppException subclasses represent known, expected business-rule violations
            // (validation errors, not-found, conflicts, etc.).
            // Log at Warning level — these are not bugs, just expected failure paths.
            _logger.LogWarning(ex, "Handled app exception: {ErrorCode}", ex.ErrorCode);

            // Use the status code and error code baked into the exception subclass
            // so the response is always semantically correct (400, 401, 404, etc.).
            await WriteErrorAsync(context, ex.StatusCode, ex.Message, ex.ErrorCode);
        }
        catch (UnauthorizedAccessException ex)
        {
            // .NET's built-in UnauthorizedAccessException can be thrown by
            // framework internals (e.g. file access) or by code that doesn't
            // use our custom AppException hierarchy.
            // Treat it as a 401 so the client knows to re-authenticate.
            _logger.LogWarning(ex, "Unauthorized access exception.");
            await WriteErrorAsync(context, StatusCodes.Status401Unauthorized, "Unauthorized.", "unauthorized");
        }
        catch (Exception ex)
        {
            // Catch-all for any unexpected exception (null reference, DB timeout, etc.).
            // Log at Error level — these are genuine bugs or infrastructure failures
            // that need investigation.
            // Return a generic 500 message — never expose internal details to the client.
            _logger.LogError(ex, "Unhandled exception.");
            await WriteErrorAsync(context, StatusCodes.Status500InternalServerError, "Unexpected server error.", "internal_server_error");
        }
    }

    // Writes a JSON error payload to the HTTP response.
    // Static because it doesn't need any instance state — it only uses
    // the parameters passed to it.
    private static async Task WriteErrorAsync(HttpContext context, int statusCode, string message, string errorCode)
    {
        // Set the HTTP status code so clients and proxies interpret the response correctly.
        context.Response.StatusCode = statusCode;

        // Tell the client the body is JSON so it knows how to parse it.
        context.Response.ContentType = "application/json";

        // Build an anonymous object that matches the ApiResponse<T> shape
        // used by all successful responses, ensuring the frontend always
        // receives the same structure regardless of success or failure.
        var payload = new
        {
            success = false,       // Always false for error responses
            message,               // Human-readable description of what went wrong
            data = (object?)null,  // No data payload on error responses
            errorCode              // Machine-readable code for frontend branching
        };

        // Serialize and write the payload to the response body.
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
