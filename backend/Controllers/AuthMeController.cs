using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("auth")]
[Authorize]
public class AuthMeController(ExpogoDbContext db, IAuditTrailService audit) : ControllerBase
{
    private static readonly HashSet<string> AllowedThemes = new(StringComparer.OrdinalIgnoreCase) { "light", "dark" };
    private static readonly HashSet<string> AllowedCurrencies = new(StringComparer.OrdinalIgnoreCase)
    {
        "BYN", "RUB", "USD", "EUR", "UAH", "GBP", "CNY", "JPY", "CHF", "PLN",
    };
    private static readonly HashSet<string> AllowedLanguages = new(StringComparer.OrdinalIgnoreCase) { "ru", "en" };

    [HttpGet("me")]
    public async Task<ActionResult<MeResponse>> GetMe(CancellationToken ct)
    {
        var userId = ParseUserId(User);
        if (userId is null) return Unauthorized();
        var tenantId = this.RequireTenantId();

        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId.Value, ct);
        if (user is null) return Unauthorized();
        var membership = await db.TenantMemberships.AsNoTracking()
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

        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId.Value, ct);
        if (user is null) return Unauthorized();

        var profileBefore = new
        {
            user.UiTheme,
            user.CurrencyCode,
            user.UiLanguage,
        };
        var quickActionsBefore = user.DashboardQuickActionsJson;
        var profileChanged = false;
        var quickActionsChanged = false;

        if (!string.IsNullOrWhiteSpace(req.Theme))
        {
            var t = req.Theme.Trim().ToLowerInvariant();
            if (!AllowedThemes.Contains(t))
                return BadRequest(new { message = "Недопустимая тема. Используйте светлая (light) или тёмная (dark)." });
            if (!string.Equals(user.UiTheme, t, StringComparison.OrdinalIgnoreCase))
            {
                user.UiTheme = t;
                profileChanged = true;
            }
        }

        if (!string.IsNullOrWhiteSpace(req.Currency))
        {
            var c = req.Currency.Trim().ToUpperInvariant();
            if (!AllowedCurrencies.Contains(c))
                return BadRequest(new { message = "Недопустимая валюта. Допустимые коды: BYN, RUB, USD, EUR, UAH, GBP, CNY, JPY, CHF, PLN." });
            if (!string.Equals(user.CurrencyCode, c, StringComparison.OrdinalIgnoreCase))
            {
                user.CurrencyCode = c;
                profileChanged = true;
            }
        }

        if (!string.IsNullOrWhiteSpace(req.Language))
        {
            var lang = req.Language.Trim().ToLowerInvariant();
            if (!AllowedLanguages.Contains(lang))
                return BadRequest(new { message = "Недопустимый язык. Используйте ru или en." });
            if (!string.Equals(user.UiLanguage, lang, StringComparison.OrdinalIgnoreCase))
            {
                user.UiLanguage = lang;
                profileChanged = true;
            }
        }

        if (req.DashboardQuickActions is not null)
        {
            var validated = DashboardQuickActionsHelper.Validate(req.DashboardQuickActions);
            var serialized = DashboardQuickActionsHelper.Serialize(validated);
            if (!string.Equals(user.DashboardQuickActionsJson, serialized, StringComparison.Ordinal))
            {
                user.DashboardQuickActionsJson = serialized;
                quickActionsChanged = true;
            }
        }

        await db.SaveChangesAsync(ct);

        if (profileChanged)
        {
            await audit.WriteAsync(
                tenantId,
                "profile.update",
                nameof(AppUser),
                user.Id.ToString(),
                profileBefore,
                new { user.UiTheme, user.CurrencyCode, user.UiLanguage },
                ct);
        }

        if (quickActionsChanged)
        {
            await audit.WriteAsync(
                tenantId,
                "dashboard.quick-actions.update",
                nameof(AppUser),
                user.Id.ToString(),
                new { quickActions = quickActionsBefore },
                new { quickActions = user.DashboardQuickActionsJson },
                ct);
        }

        var membership = await db.TenantMemberships.AsNoTracking()
            .SingleOrDefaultAsync(x => x.UserId == userId.Value && x.TenantId == tenantId, ct);
        if (membership is null) return Forbid();
        return Ok(ToResponse(user, tenantId, membership.Role.ToString()));
    }

    private static MeResponse ToResponse(AppUser user, int tenantId, string role)
    {
        var actions = DashboardQuickActionsHelper.Resolve(user.DashboardQuickActionsJson);
        return new MeResponse(
            user.Id,
            user.Username,
            user.FullName,
            user.Email,
            user.UiTheme,
            user.CurrencyCode,
            user.UiLanguage,
            tenantId,
            role,
            actions
        );
    }

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
    public string Language { get; init; }
    public int TenantId { get; init; }
    public string TenantRole { get; init; }
    public IReadOnlyList<DashboardQuickActionDto> DashboardQuickActions { get; init; }

    public MeResponse(
        int id,
        string username,
        string? fullName,
        string? email,
        string theme,
        string currency,
        string language,
        int tenantId,
        string tenantRole,
        IReadOnlyList<DashboardQuickActionDto> dashboardQuickActions)
    {
        Id = id;
        Username = username;
        FullName = fullName;
        Email = email;
        Theme = theme;
        Currency = currency;
        Language = language;
        TenantId = tenantId;
        TenantRole = tenantRole;
        DashboardQuickActions = dashboardQuickActions;
    }
}

public class UpdatePreferencesRequest
{
    public string? Theme { get; set; }
    public string? Currency { get; set; }
    public string? Language { get; set; }
    public List<DashboardQuickActionDto>? DashboardQuickActions { get; set; }
}
