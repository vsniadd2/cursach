using ExpogoCrm.Api.Data;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ExpogoCrm.Api.Services.Integrations;

public interface IGoogleCalendarIntegrationService
{
    bool IsOAuthConfigured { get; }
    string BuildAuthorizationUrl(int tenantId, int userId);
    Task<string> HandleCallbackAsync(string code, string state, CancellationToken ct = default);
    Task TestAsync(int tenantId, CancellationToken ct = default);
    Task SyncTaskAsync(int tenantId, TaskItem task, CancellationToken ct = default);
    Task DeleteTaskEventAsync(int tenantId, TaskItem task, CancellationToken ct = default);
}

public sealed class GoogleCalendarIntegrationService(
    ExpogoDbContext db,
    IOptions<GoogleIntegrationOptions> options,
    IHttpClientFactory httpFactory) : IGoogleCalendarIntegrationService
{
    readonly GoogleIntegrationOptions _opt = options.Value;

    public bool IsOAuthConfigured =>
        !string.IsNullOrWhiteSpace(_opt.ClientId) && !string.IsNullOrWhiteSpace(_opt.ClientSecret);

    public string BuildAuthorizationUrl(int tenantId, int userId)
    {
        if (!IsOAuthConfigured)
            throw new InvalidOperationException("Google OAuth не настроен (Integrations:Google).");

        var state = IntegrationOAuthState.Create(tenantId, userId, _opt.StateSigningKey, TimeSpan.FromMinutes(15));
        var scope = string.Join(" ", _opt.Scopes);
        var q = new Dictionary<string, string?>
        {
            ["client_id"] = _opt.ClientId,
            ["redirect_uri"] = _opt.RedirectUri,
            ["response_type"] = "code",
            ["scope"] = scope,
            ["state"] = state,
            ["access_type"] = "offline",
            ["prompt"] = "consent",
        };
        var query = string.Join("&", q.Where(x => !string.IsNullOrEmpty(x.Value))
            .Select(x => $"{Uri.EscapeDataString(x.Key)}={Uri.EscapeDataString(x.Value!)}"));
        return $"https://accounts.google.com/o/oauth2/v2/auth?{query}";
    }

    public async Task<string> HandleCallbackAsync(string code, string state, CancellationToken ct = default)
    {
        if (!IntegrationOAuthState.TryParse(state, _opt.StateSigningKey, out var tenantId, out _))
            throw new InvalidOperationException("Недействительный OAuth state.");

        var flow = CreateFlow();
        var token = await flow.ExchangeCodeForTokenAsync(null, code, _opt.RedirectUri, ct);

        var row = await db.TenantIntegrations
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == IntegrationProviders.GoogleCalendar, ct)
            ?? new TenantIntegration
            {
                TenantId = tenantId,
                Provider = IntegrationProviders.GoogleCalendar,
                ConfigJson = IntegrationJson.Serialize(new GoogleCalendarIntegrationConfig()),
            };

        if (row.Id == 0)
            db.TenantIntegrations.Add(row);

        var secrets = new GoogleCalendarIntegrationSecrets
        {
            RefreshToken = token.RefreshToken,
            AccessToken = token.AccessToken,
            ExpiresAtUtc = DateTime.UtcNow.AddSeconds(token.ExpiresInSeconds ?? 3600),
        };
        row.SecretsJson = IntegrationJson.Serialize(secrets);
        row.IsEnabled = true;
        row.UpdatedAtUtc = DateTime.UtcNow;

        var config = IntegrationJson.Deserialize<GoogleCalendarIntegrationConfig>(row.ConfigJson) ?? new();
        config.ConnectedEmail = await TryGetEmailAsync(token.AccessToken, ct);
        row.ConfigJson = IntegrationJson.Serialize(config);

        await db.SaveChangesAsync(ct);
        return $"{_opt.FrontendSuccessUrl.TrimEnd('/')}/?gcal=connected";
    }

    public async Task TestAsync(int tenantId, CancellationToken ct = default)
    {
        var service = await CreateCalendarServiceAsync(tenantId, ct);
        var config = await GetConfigAsync(tenantId, ct);
        var ev = new Event
        {
            Summary = "Expogo CRM — тест интеграции",
            Description = "Событие создано кнопкой «Проверить» в разделе Интеграции.",
            Start = new EventDateTime { DateTimeDateTimeOffset = DateTimeOffset.UtcNow.AddHours(1), TimeZone = "UTC" },
            End = new EventDateTime { DateTimeDateTimeOffset = DateTimeOffset.UtcNow.AddHours(2), TimeZone = "UTC" },
        };
        await service.Events.Insert(ev, config.CalendarId).ExecuteAsync(ct);
    }

    public async Task SyncTaskAsync(int tenantId, TaskItem task, CancellationToken ct = default)
    {
        var entity = await db.TenantIntegrations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == IntegrationProviders.GoogleCalendar, ct);
        if (entity is null || !entity.IsEnabled) return;

        var config = IntegrationJson.Deserialize<GoogleCalendarIntegrationConfig>(entity.ConfigJson) ?? new();
        if (!config.SyncTasks) return;

        var service = await CreateCalendarServiceAsync(tenantId, ct);
        var start = task.Date.ToDateTime(task.Time ?? TimeOnly.MinValue, DateTimeKind.Utc);
        var end = start.AddHours(1);
        var ev = new Event
        {
            Summary = $"CRM: {task.Title}",
            Description = task.Description,
            Start = new EventDateTime { DateTimeDateTimeOffset = start, TimeZone = "UTC" },
            End = new EventDateTime { DateTimeDateTimeOffset = end, TimeZone = "UTC" },
        };

        var tracked = await db.Tasks.SingleAsync(x => x.Id == task.Id, ct);
        if (!string.IsNullOrWhiteSpace(tracked.GoogleEventId))
        {
            await service.Events.Patch(ev, config.CalendarId, tracked.GoogleEventId).ExecuteAsync(ct);
        }
        else
        {
            var created = await service.Events.Insert(ev, config.CalendarId).ExecuteAsync(ct);
            tracked.GoogleEventId = created.Id;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task DeleteTaskEventAsync(int tenantId, TaskItem task, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(task.GoogleEventId)) return;
        var entity = await db.TenantIntegrations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == IntegrationProviders.GoogleCalendar, ct);
        if (entity is null || !entity.IsEnabled) return;

        var config = IntegrationJson.Deserialize<GoogleCalendarIntegrationConfig>(entity.ConfigJson) ?? new();
        var service = await CreateCalendarServiceAsync(tenantId, ct);
        try
        {
            await service.Events.Delete(config.CalendarId, task.GoogleEventId).ExecuteAsync(ct);
        }
        catch
        {
            // event may already be removed
        }
    }

    async Task<CalendarService> CreateCalendarServiceAsync(int tenantId, CancellationToken ct)
    {
        var entity = await db.TenantIntegrations
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == IntegrationProviders.GoogleCalendar, ct)
            ?? throw new InvalidOperationException("Google Calendar не подключён.");

        var secrets = IntegrationJson.Deserialize<GoogleCalendarIntegrationSecrets>(entity.SecretsJson)
            ?? throw new InvalidOperationException("Нет токенов Google.");

        if (string.IsNullOrWhiteSpace(secrets.RefreshToken) && string.IsNullOrWhiteSpace(secrets.AccessToken))
            throw new InvalidOperationException("Подключите Google Calendar.");

        var flow = CreateFlow();
        var token = new TokenResponse
        {
            AccessToken = secrets.AccessToken,
            RefreshToken = secrets.RefreshToken,
            ExpiresInSeconds = secrets.ExpiresAtUtc is null
                ? 3600
                : (long)Math.Max(60, (secrets.ExpiresAtUtc.Value - DateTime.UtcNow).TotalSeconds),
        };

        var credential = new UserCredential(flow, "user", token);
        if (credential.Token.ExpiresInSeconds is <= 120)
        {
            var refreshed = await credential.RefreshTokenAsync(ct);
            if (!refreshed)
                throw new InvalidOperationException("Не удалось обновить токен Google.");

            secrets.AccessToken = credential.Token.AccessToken;
            secrets.RefreshToken = credential.Token.RefreshToken ?? secrets.RefreshToken;
            secrets.ExpiresAtUtc = DateTime.UtcNow.AddSeconds(credential.Token.ExpiresInSeconds ?? 3600);
            entity.SecretsJson = IntegrationJson.Serialize(secrets);
            entity.UpdatedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return new CalendarService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "Expogo CRM",
        });
    }

    async Task<GoogleCalendarIntegrationConfig> GetConfigAsync(int tenantId, CancellationToken ct)
    {
        var entity = await db.TenantIntegrations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == IntegrationProviders.GoogleCalendar, ct);
        return IntegrationJson.Deserialize<GoogleCalendarIntegrationConfig>(entity?.ConfigJson) ?? new();
    }

    async Task<string?> TryGetEmailAsync(string? accessToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(accessToken)) return null;
        var http = httpFactory.CreateClient(nameof(GoogleCalendarIntegrationService));
        using var req = new HttpRequestMessage(HttpMethod.Get, "https://www.googleapis.com/oauth2/v2/userinfo");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;
        var json = await res.Content.ReadFromJsonAsync<UserInfo>(cancellationToken: ct);
        return json?.Email;
    }

    GoogleAuthorizationCodeFlow CreateFlow() =>
        new(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _opt.ClientId,
                ClientSecret = _opt.ClientSecret,
            },
            Scopes = _opt.Scopes,
        });

    sealed class UserInfo
    {
        public string? Email { get; set; }
    }

}
