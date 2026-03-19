namespace AuthService.DTOs;

// What the frontend SENDS to register
public record RegisterRequest(
    string FullName,
    string Email,
    string PhoneNumber,
    string Password        // plain text — we hash it in the service
);

// What the frontend SENDS to login
public record LoginRequest(
    string Email,
    string Password
);

// What the frontend SENDS for KYC
public record KycSubmitRequest(
    string DocumentType,    // "passport" / "national_id" / "driving_license"
    string DocumentNumber
);

// What we SEND BACK after register or login
public record AuthResponse(
    string Token,
    string UserId,
    string FullName,
    string Email,
    string Role,
    string Status
);

// What we SEND BACK for profile
public record UserProfileResponse(
    Guid UserId,
    string FullName,
    string Email,
    string PhoneNumber,
    string Status,
    string Role,
    KycResponse? Kyc
);

public record KycResponse(
    Guid Id,
    string DocumentType,
    string DocumentNumber,
    string Status,
    string? AdminNote,
    DateTime SubmittedAt,
    DateTime? ReviewedAt
);

// Generic wrapper for ALL API responses
// Every endpoint returns this shape:
// { "success": true, "message": "Registered", "data": { ... } }
// { "success": false, "message": "Email taken", "data": null }
public record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data
);