// ============================================================
// TokenService.cs — AuthService
// ------------------------------------------------------------
// Generates signed JSON Web Tokens (JWTs) for authenticated users.
//
// A JWT has three parts separated by dots:
//   Header  — algorithm used (HS256)
//   Payload — claims: userId, email, name, role, status
//   Signature — HMAC-SHA256 of header+payload using the secret key
//
// Every backend service validates tokens independently using the
// same shared secret key — no service needs to call AuthService
// to check if a token is valid (stateless authentication).
//
// Token lifetime: 8 hours. The frontend refreshes every 15 minutes
// via POST /api/auth/refresh to keep the session alive.
// ============================================================

using AuthService.Models;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AuthService.Services;

// Interface allows unit tests to inject a FakeTokenService that returns
// a predictable token string without needing a real signing key.
public interface ITokenService
{
    string GenerateToken(User user);
}

public class TokenService : ITokenService
{
    // IConfiguration reads values from appsettings.json / environment variables.
    // Required keys: Jwt:Key (≥32 chars), Jwt:Issuer, Jwt:Audience.
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config)
    {
        _config = config;
    }

    // ── GenerateToken ────────────────────────────────────────────────────────
    // Builds and signs a JWT for the given user.
    // The token embeds the user's ID, email, name, role, and KYC status as claims
    // so downstream services can read them without a database call.
    public string GenerateToken(User user)
    {
        // Read the signing key from configuration.
        // Must be at least 32 characters (256 bits) for HMAC-SHA256.
        var jwtKey = _config["Jwt:Key"] ?? string.Empty;
        var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
        if (keyBytes.Length < 32)
        {
            // Fail fast at startup rather than silently issuing weak tokens.
            throw new InvalidOperationException(
                "Jwt:Key must be at least 32 characters (256 bits). " +
                "Set a stronger value via configuration, e.g. Jwt__Key environment variable.");
        }

        // Step 1 — Wrap the key bytes in a SymmetricSecurityKey and choose HMAC-SHA256.
        var key = new SymmetricSecurityKey(keyBytes);
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // Step 2 — Define the claims embedded in the token payload.
        // These are readable by any service that validates the token.
        // ClaimTypes.NameIdentifier → userId (used by all controllers as CurrentUserId)
        // ClaimTypes.Role           → "User" or "Admin" (used by [Authorize(Roles="Admin")])
        // "status"                  → "Pending" / "Active" / "Rejected"
        //                             WalletService reads this to block KYC-pending users.
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),  // primary identity
            new Claim(ClaimTypes.Email,          user.Email),
            new Claim(ClaimTypes.Name,           user.FullName),
            new Claim(ClaimTypes.Role,           user.Role),           // for role-based auth
            new Claim("status",                  user.Status)          // KYC status
        };

        // Step 3 — Assemble the token with issuer, audience, claims, and expiry.
        // Issuer and Audience must match the values configured in every service's
        // JWT validation parameters (Program.cs) — mismatches cause 401 errors.
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),  // 8-hour session window
            signingCredentials: creds
        );

        // Step 4 — Serialize the token to the compact "eyJ..." string format
        // that the frontend stores in localStorage and sends as "Bearer <token>".
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
