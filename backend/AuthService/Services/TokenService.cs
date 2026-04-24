using AuthService.Models;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AuthService.Services;

// Interface — defines WHAT the service does
// We always write an interface so we can easily swap or mock it later
public interface ITokenService
{
    string GenerateToken(User user);
}

public class TokenService : ITokenService
{
    private readonly IConfiguration _config;

    // IConfiguration lets us read values from appsettings.json
    public TokenService(IConfiguration config)
    {
        _config = config;
    }

    public string GenerateToken(User user)
    {
        var jwtKey = _config["Jwt:Key"] ?? string.Empty;
        var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
        if (keyBytes.Length < 32)
        {
            throw new InvalidOperationException(
                "Jwt:Key must be at least 32 characters (256 bits). " +
                "Set a stronger value via configuration, e.g. Jwt__Key environment variable.");
        }

        // Step 1 — Create signing key from our secret in appsettings.json
        // Must be at least 32 characters long
        var key = new SymmetricSecurityKey(
                        keyBytes);
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // Step 2 — Claims are pieces of info baked INTO the token
        // The frontend can read these without calling the server
        // This is why JWT is powerful — the token carries the user's info
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email,          user.Email),
            new Claim(ClaimTypes.Name,           user.FullName),
            new Claim(ClaimTypes.Role,           user.Role),

            // Custom claim — we store status so WalletService can check
            // if user is Active before allowing wallet operations
            new Claim("status", user.Status)
        };

        // Step 3 — Build the token
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds
        );

        // Step 4 — Serialize token to string like "eyJhbGci..."
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
