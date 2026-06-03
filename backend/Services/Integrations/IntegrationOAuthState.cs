using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace ExpogoCrm.Api.Services.Integrations;

public static class IntegrationOAuthState
{
    public static string Create(int tenantId, int userId, string signingKey, TimeSpan lifetime)
    {
        var exp = DateTimeOffset.UtcNow.Add(lifetime).ToUnixTimeSeconds();
        var payload = $"{tenantId}:{userId}:{exp}";
        var sig = Sign(payload, signingKey);
        return WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes($"{payload}:{sig}"));
    }

    public static bool TryParse(string state, string signingKey, out int tenantId, out int userId)
    {
        tenantId = 0;
        userId = 0;
        try
        {
            var raw = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(state));
            var parts = raw.Split(':');
            if (parts.Length != 4) return false;
            if (!int.TryParse(parts[0], out tenantId) || !int.TryParse(parts[1], out userId)) return false;
            if (!long.TryParse(parts[2], out var expUnix)) return false;
            var payload = $"{parts[0]}:{parts[1]}:{parts[2]}";
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(Sign(payload, signingKey)),
                    Encoding.UTF8.GetBytes(parts[3])))
                return false;
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expUnix) return false;
            return true;
        }
        catch
        {
            return false;
        }
    }

    static string Sign(string payload, string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return WebEncoders.Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }
}
