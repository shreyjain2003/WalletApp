using System.Text.Json;
using WalletService.Common.Exceptions;

namespace WalletService.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (AppException ex)
        {
            _logger.LogWarning(ex, "Handled app exception: {ErrorCode}", ex.ErrorCode);
            await WriteErrorAsync(context, ex.StatusCode, ex.Message, ex.ErrorCode);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access exception.");
            await WriteErrorAsync(context, StatusCodes.Status401Unauthorized, "Unauthorized.", "unauthorized");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception.");
            await WriteErrorAsync(context, StatusCodes.Status500InternalServerError, "Unexpected server error.", "internal_server_error");
        }
    }

    private static async Task WriteErrorAsync(HttpContext context, int statusCode, string message, string errorCode)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var payload = new
        {
            success = false,
            message,
            data = (object?)null,
            errorCode
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
