using System.Security.Claims;
using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("auth")]
[Authorize]
public class AuthMeController : ControllerBase
{
    private static readonly HashSet<string> AllowedThemes = new(StringComparer.OrdinalIgnoreCase) { "light", "dark" };
    private static readonly HashSet<string> AllowedCurrencies = new(StringComparer.OrdinalIgnoreCase)
    {
        "BYN", "RUB", "USD", "EUR", "UAH", "GBP", "CNY", "JPY", "CHF", "PLN",
    };

    private readonly ExpogoDbContext _db;

    public AuthMeController(ExpogoDbContext db)
    {
        _db = db;
    }

    [HttpGet("me")]
    public async Task<ActionResult<MeResponse>> GetMe(CancellationToken ct)
    {
        var userId = ParseUserId(User);
        if (userId is null) return Unauthorized();
        var tenantId = this.RequireTenantId();

        var user = await _db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId.Value, ct);
        if (user is null) return Unauthorized();
        var membership = await _db.TenantMemberships.AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == userId.Value && x.TenantId == tenantId, ct);
        if (membership is null) return Forbid();

        return Ok(ToResponse(user, tenantId, membership.Role.ToString()));
    }

    [HttpPatch("me/preferences")]
    public async Task<ActionResult<MeResponse>> PatchPreferences([FromBody] UpdatePreferencesRequest req, CancellationToken ct)
    {
        var userId = ParseUserId(User);
        if (userId is null) return Unauthorized();
        var tenantId = this.RequireTenantId();

        var user = await _db.Users.SingleOrDefaultAsync(x => x.Id == userId.Value, ct);
        if (user is null) return Unauthorized();

        if (!string.IsNullOrWhiteSpace(req.Theme))
        {
            var t = req.Theme.Trim().ToLowerInvariant();
            if (!AllowedThemes.Contains(t))
                return BadRequest(new { message = "Недопустимая тема. Используйте light или dark." });
            user.UiTheme = t;
        }

        if (!string.IsNullOrWhiteSpace(req.Currency))
        {
            var c = req.Currency.Trim().ToUpperInvariant();
            if (!AllowedCurrencies.Contains(c))
                return BadRequest(new { message = "Недопустимая валюта. Допустимые коды: BYN, RUB, USD, EUR, UAH, GBP, CNY, JPY, CHF, PLN." });
            user.CurrencyCode = c;
        }

        await _db.SaveChangesAsync(ct);
        var membership = await _db.TenantMemberships.AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == userId.Value && x.TenantId == tenantId, ct);
        if (membership is null) return Forbid();
        return Ok(ToResponse(user, tenantId, membership.Role.ToString()));
    }

    private static MeResponse ToResponse(AppUser user, int tenantId, string role) =>
        new(
            user.Id,
            user.Username,
            user.FullName,
            user.Email,
            user.UiTheme,
            user.CurrencyCode,
            tenantId,
            role
        );

    private static int? ParseUserId(ClaimsPrincipal user)
    {
        var sub =
            user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(sub, out var id) ? id : null;
    }
}

public sealed class MeResponse
{
    public int Id { get; init; }
    public string Username { get; init; }
    public string? FullName { get; init; }
    public string? Email { get; init; }
    public string Theme { get; init; }
    public string Currency { get; init; }
    public int TenantId { get; init; }
    public string TenantRole { get; init; }

    public MeResponse(int id, string username, string? fullName, string? email, string theme, string currency, int tenantId, string tenantRole)
    {
        Id = id;
        Username = username;
        FullName = fullName;
        Email = email;
        Theme = theme;
        Currency = currency;
        TenantId = tenantId;
        TenantRole = tenantRole;
    }
}

public class UpdatePreferencesRequest
{
    public string? Theme { get; set; }
    public string? Currency { get; set; }
}
