// AppException.cs
// Defines the custom exception hierarchy for the AuthService.
// Instead of throwing generic .NET exceptions (which would result in 500 errors),
// every business-rule violation throws one of these typed exceptions.
// The ExceptionHandlingMiddleware catches them and converts them into
// structured JSON error responses with the correct HTTP status code.

namespace AuthService.Common.Exceptions;

// Base class for all application-level exceptions.
// Marked abstract so it can never be thrown directly — callers must use
// one of the concrete subclasses that carry a meaningful HTTP status code.
public abstract class AppException : Exception
{
    // The HTTP status code that should be returned to the client
    // (e.g. 400, 401, 404). Stored here so the middleware doesn't need
    // a big switch statement to decide which status to use.
    public int StatusCode { get; }

    // A machine-readable error code string (e.g. "not_found", "validation_error")
    // included in the JSON response so the frontend can branch on it
    // without parsing the human-readable message.
    public string ErrorCode { get; }

    // Protected constructor — only subclasses can call this.
    // Forces every concrete exception to supply all three pieces of information
    // so the middleware always has everything it needs to build the response.
    protected AppException(string message, int statusCode, string errorCode)
        : base(message) // Pass the human-readable message up to System.Exception
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }
}

// Thrown when incoming request data fails validation rules
// (e.g. missing required field, invalid format).
// Maps to HTTP 400 Bad Request.
public sealed class AppValidationException : AppException
{
    public AppValidationException(string message)
        : base(message, StatusCodes.Status400BadRequest, "validation_error") { }
}

// Thrown when a requested resource does not exist in the database
// (e.g. user ID not found, KYC document missing).
// Maps to HTTP 404 Not Found.
public sealed class NotFoundAppException : AppException
{
    public NotFoundAppException(string message)
        : base(message, StatusCodes.Status404NotFound, "not_found") { }
}

// Thrown when the caller is not authenticated or their token is invalid/expired.
// Maps to HTTP 401 Unauthorized.
public sealed class UnauthorizedAppException : AppException
{
    public UnauthorizedAppException(string message)
        : base(message, StatusCodes.Status401Unauthorized, "unauthorized") { }
}

// Thrown when the caller IS authenticated but lacks permission for the action
// (e.g. a regular user trying to access an admin-only endpoint).
// Maps to HTTP 403 Forbidden.
public sealed class ForbiddenAppException : AppException
{
    public ForbiddenAppException(string message)
        : base(message, StatusCodes.Status403Forbidden, "forbidden") { }
}

// Thrown when a uniqueness constraint would be violated
// (e.g. registering with an email that already exists).
// Maps to HTTP 409 Conflict.
public sealed class ConflictAppException : AppException
{
    public ConflictAppException(string message)
        : base(message, StatusCodes.Status409Conflict, "conflict") { }
}

// Thrown when a downstream service (e.g. RabbitMQ, notification service)
// fails in a way that prevents the current operation from completing.
// Maps to HTTP 502 Bad Gateway to signal the problem is upstream, not in our code.
public sealed class ExternalServiceAppException : AppException
{
    public ExternalServiceAppException(string message)
        : base(message, StatusCodes.Status502BadGateway, "external_service_error") { }
}
