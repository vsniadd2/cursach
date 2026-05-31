using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ExpogoCrm.Api.Data;
using Microsoft.IdentityModel.Tokens;

namespace ExpogoCrm.Api.Auth;

public sealed class JwtTokenService
{
    private readonly IConfiguration _cfg;

    public JwtTokenService(IConfiguration cfg)
    {
        _cfg = cfg;
    }

    public string CreateAccessToken(AppUser user, int tenantId, TenantRole role)
    {
        var issuer = _cfg["Jwt:Issuer"] ?? "Nexara";
        var audience = _cfg["Jwt:Audience"] ?? "NexaraClient";
        var secret =
            _cfg["Jwt:Secret"]
            ?? "cursach-dev-jwt-secret-key-minimum-32-characters-long";
        var minutes = int.Parse(_cfg["Jwt:AccessTokenMinutes"] ?? "10");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim("tenant_id", tenantId.ToString()),
            new Claim("tenant_role", role.ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(minutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static string CreateRefreshToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    }

    public static string HashRefreshToken(string refreshToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

