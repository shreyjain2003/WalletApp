namespace NotificationService.Common.Exceptions;

public abstract class AppException : Exception
{
    public int StatusCode { get; }
    public string ErrorCode { get; }

    protected AppException(string message, int statusCode, string errorCode)
        : base(message)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }
}

public sealed class AppValidationException : AppException
{
    public AppValidationException(string message)
        : base(message, StatusCodes.Status400BadRequest, "validation_error") { }
}

public sealed class NotFoundAppException : AppException
{
    public NotFoundAppException(string message)
        : base(message, StatusCodes.Status404NotFound, "not_found") { }
}

public sealed class UnauthorizedAppException : AppException
{
    public UnauthorizedAppException(string message)
        : base(message, StatusCodes.Status401Unauthorized, "unauthorized") { }
}

public sealed class ForbiddenAppException : AppException
{
    public ForbiddenAppException(string message)
        : base(message, StatusCodes.Status403Forbidden, "forbidden") { }
}

public sealed class ConflictAppException : AppException
{
    public ConflictAppException(string message)
        : base(message, StatusCodes.Status409Conflict, "conflict") { }
}

public sealed class ExternalServiceAppException : AppException
{
    public ExternalServiceAppException(string message)
        : base(message, StatusCodes.Status502BadGateway, "external_service_error") { }
}
