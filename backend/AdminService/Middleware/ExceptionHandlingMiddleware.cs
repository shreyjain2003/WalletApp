using System.Text.Json;
using AdminService.Common.Exceptions;

namespace AdminService.Middleware;

// ASP.NET Core middleware that intercepts all unhandled exceptions thrown during
// request processing and converts them into structured JSON error responses.
// Without this, ASP.NET would return HTML error pages or raw stack traces to API
// clients, which is both insecure and unusable by the frontend.
// Registered in Program.cs before UseAuthentication so it catches auth errors too.
public class ExceptionHandlingMiddleware
{
    // The next middleware in the pipeline — called inside a try/catch so any
    // exception it throws (or that any downstream middleware throws) is caught here.
    private readonly RequestDelegate _next;

    // Logger used to record exception details for server-side diagnostics.
    // Warnings are used for expected/handled exceptions; errors for unexpected ones.
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    // Constructor receives dependencies via DI.
    // RequestDelegate is the rest of the middleware pipeline after this point.
    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    // Called by the ASP.NET Core runtime for every incoming HTTP request.
    // Wraps the downstream pipeline in a try/catch to guarantee that every
    // exception produces a well-formed JSON response instead of crashing the request.
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            // Pass control to the next middleware (routing, auth, controllers, etc.).
            // If everything succeeds, execution returns here and the method exits normally.
            await _next(context);
        }
        catch (AppException ex)
        {
            // AppException is the base class for all intentional, domain-level errors
            // (validation failures, not-found, unauthorized, etc.).
            // These are expected conditions — log as Warning, not Error, to avoid
            // polluting error dashboards with normal business logic outcomes.
            _logger.LogWarning(ex, "Handled app exception: {ErrorCode}", ex.ErrorCode);
            await WriteErrorAsync(context, ex.StatusCode, ex.Message, ex.ErrorCode);
        }
        catch (UnauthorizedAccessException ex)
        {
            // Thrown by .NET itself (not our code) when access is denied at the
            // framework level. Map to 401 so the client knows to re-authenticate.
            _logger.LogWarning(ex, "Unauthorized access exception.");
            await WriteErrorAsync(context, StatusCodes.Status401Unauthorized, "Unauthorized.", "unauthorized");
        }
        catch (Exception ex)
        {
            // Catch-all for any unexpected exception (null reference, DB timeout, etc.).
            // Log as Error so it appears in alerts. Return a generic 500 message to
            // avoid leaking internal implementation details (stack traces, SQL, etc.)
            // to the client.
            _logger.LogError(ex, "Unhandled exception.");
            await WriteErrorAsync(context, StatusCodes.Status500InternalServerError, "Unexpected server error.", "internal_server_error");
        }
    }

    // Writes a consistent JSON error envelope to the HTTP response.
    // Static because it has no dependency on instance state — keeps it pure and testable.
    // Sets the status code and content type before writing the body so the response
    // headers are correct even if the body write fails.
    private static async Task WriteErrorAsync(HttpContext context, int statusCode, string message, string errorCode)
    {
        // Set the HTTP status code so clients and proxies interpret the response correctly.
        context.Response.StatusCode = statusCode;

        // Tell the client this is JSON, not HTML, so it parses it as an API response.
        context.Response.ContentType = "application/json";

        // Build the error payload using the same shape as successful ApiResponse<T>
        // so the frontend can handle errors and successes with the same code path.
        var payload = new
        {
            success = false,       // Always false for error responses
            message,               // Human-readable description of what went wrong
            data = (object?)null,  // No data payload on error
            errorCode              // Machine-readable code for programmatic error handling
        };

        // Serialize and write the payload to the response body.
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
