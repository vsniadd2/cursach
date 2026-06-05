using ExpogoCrm.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Services.Integrations;

public interface ITenantIntegrationService
{
    Task<IReadOnlyList<IntegrationProviderSummaryDto>> ListProvidersAsync(int tenantId, CancellationToken ct = default);
    Task<IntegrationProviderDetailDto> GetProviderAsync(int tenantId, string provider, CancellationToken ct = default);
    Task<IntegrationProviderDetailDto> UpsertAsync(int tenantId, string provider, UpdateIntegrationRequest req, CancellationToken ct = default);
    Task<TenantIntegration?> GetEntityAsync(int tenantId, string provider, CancellationToken ct = default);
}

public sealed class TenantIntegrationService(
    ExpogoDbContext db,
    IGoogleCalendarIntegrationService googleCalendar) : ITenantIntegrationService
{
    static readonly Dictionary<string, string> DisplayNames = new(StringComparer.OrdinalIgnoreCase)
    {
        [IntegrationProviders.Telegram] = "Telegram",
        [IntegrationProviders.Email] = "Email",
        [IntegrationProviders.GoogleCalendar] = "Google Calendar",
    };

    public async Task<IReadOnlyList<IntegrationProviderSummaryDto>> ListProvidersAsync(int tenantId, CancellationToken ct = default)
    {
        var rows = await db.TenantIntegrations.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToDictionaryAsync(x => x.Provider, x => x, StringComparer.OrdinalIgnoreCase, ct);

        return IntegrationProviders.All.Select(id =>
        {
            rows.TryGetValue(id, out var row);
            return new IntegrationProviderSummaryDto
            {
                Id = id,
                Name = DisplayNames[id],
                IsEnabled = row?.IsEnabled ?? false,
                IsConfigured = IsConfigured(id, row),
                Summary = BuildSummary(id, row),
            };
        }).ToList();
    }

    public async Task<IntegrationProviderDetailDto> GetProviderAsync(int tenantId, string provider, CancellationToken ct = default)
    {
        ValidateProvider(provider);
        var row = await GetOrCreateTrackedAsync(tenantId, provider, ct);
        return ToDetail(provider, row, googleCalendar.IsOAuthConfigured);
    }

    public async Task<IntegrationProviderDetailDto> UpsertAsync(
        int tenantId,
        string provider,
        UpdateIntegrationRequest req,
        CancellationToken ct = default)
    {
        ValidateProvider(provider);
        var row = await GetOrCreateTrackedAsync(tenantId, provider, ct);

        if (req.IsEnabled is not null)
            row.IsEnabled = req.IsEnabled.Value;

        if (req.Config is not null)
            row.ConfigJson = MergeConfig(provider, row.ConfigJson, req.Config.Value);

        if (req.Secrets is not null)
            row.SecretsJson = MergeSecrets(provider, row.SecretsJson, req.Secrets.Value);

        row.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return ToDetail(provider, row, googleCalendar.IsOAuthConfigured);
    }

    public Task<TenantIntegration?> GetEntityAsync(int tenantId, string provider, CancellationToken ct = default) =>
        db.TenantIntegrations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == provider, ct);

    async Task<TenantIntegration> GetOrCreateTrackedAsync(int tenantId, string provider, CancellationToken ct)
    {
        var row = await db.TenantIntegrations
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == provider, ct);
        if (row is not null) return row;

        row = new TenantIntegration
        {
            TenantId = tenantId,
            Provider = provider,
            IsEnabled = false,
            ConfigJson = DefaultConfigJson(provider),
            SecretsJson = null,
            UpdatedAtUtc = DateTime.UtcNow,
        };
        db.TenantIntegrations.Add(row);
        await db.SaveChangesAsync(ct);
        return row;
    }

    static void ValidateProvider(string provider)
    {
        if (!IntegrationProviders.All.Contains(provider, StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException($"Unknown provider: {provider}");
    }

    static string DefaultConfigJson(string provider) => provider switch
    {
        IntegrationProviders.Telegram => IntegrationJson.Serialize(new TelegramIntegrationConfig()),
        IntegrationProviders.Email => IntegrationJson.Serialize(new EmailIntegrationConfig()),
        IntegrationProviders.GoogleCalendar => IntegrationJson.Serialize(new GoogleCalendarIntegrationConfig()),
        _ => "{}",
    };

    static string MergeConfig(string provider, string? existing, System.Text.Json.JsonElement patch)
    {
        if (provider == IntegrationProviders.Telegram)
        {
            var current = IntegrationJson.Deserialize<TelegramIntegrationConfig>(existing) ?? new();
            var merged = System.Text.Json.JsonSerializer.Deserialize<TelegramIntegrationConfig>(patch.GetRawText(), IntegrationJson.Options) ?? current;
            return IntegrationJson.Serialize(merged);
        }
        if (provider == IntegrationProviders.Email)
        {
            var current = IntegrationJson.Deserialize<EmailIntegrationConfig>(existing) ?? new();
            var merged = System.Text.Json.JsonSerializer.Deserialize<EmailIntegrationConfig>(patch.GetRawText(), IntegrationJson.Options) ?? current;
            return IntegrationJson.Serialize(merged);
        }
        if (provider == IntegrationProviders.GoogleCalendar)
        {
            var current = IntegrationJson.Deserialize<GoogleCalendarIntegrationConfig>(existing) ?? new();
            var merged = System.Text.Json.JsonSerializer.Deserialize<GoogleCalendarIntegrationConfig>(patch.GetRawText(), IntegrationJson.Options) ?? current;
            return IntegrationJson.Serialize(merged);
        }
        throw new ArgumentException("Unknown provider");
    }

    static string MergeSecrets(string provider, string? existing, System.Text.Json.JsonElement patch)
    {
        if (provider == IntegrationProviders.Telegram)
        {
            var merged = System.Text.Json.JsonSerializer.Deserialize<TelegramIntegrationSecrets>(patch.GetRawText(), IntegrationJson.Options) ?? new();
            if (string.IsNullOrWhiteSpace(merged.BotToken))
                merged.BotToken = IntegrationJson.Deserialize<TelegramIntegrationSecrets>(existing)?.BotToken ?? "";
            return IntegrationJson.Serialize(merged);
        }
        if (provider == IntegrationProviders.Email)
        {
            var merged = System.Text.Json.JsonSerializer.Deserialize<EmailIntegrationSecrets>(patch.GetRawText(), IntegrationJson.Options) ?? new();
            if (string.IsNullOrWhiteSpace(merged.SmtpPassword))
                merged.SmtpPassword = IntegrationJson.Deserialize<EmailIntegrationSecrets>(existing)?.SmtpPassword ?? "";
            return IntegrationJson.Serialize(merged);
        }
        if (provider == IntegrationProviders.GoogleCalendar)
        {
            var merged = System.Text.Json.JsonSerializer.Deserialize<GoogleCalendarIntegrationSecrets>(patch.GetRawText(), IntegrationJson.Options) ?? new();
            var prev = IntegrationJson.Deserialize<GoogleCalendarIntegrationSecrets>(existing);
            if (string.IsNullOrWhiteSpace(merged.RefreshToken)) merged.RefreshToken = prev?.RefreshToken;
            if (string.IsNullOrWhiteSpace(merged.AccessToken)) merged.AccessToken = prev?.AccessToken;
            if (merged.ExpiresAtUtc is null) merged.ExpiresAtUtc = prev?.ExpiresAtUtc;
            return IntegrationJson.Serialize(merged);
        }
        throw new ArgumentException("Unknown provider");
    }

    static bool IsConfigured(string provider, TenantIntegration? row)
    {
        if (row is null) return false;
        return provider switch
        {
            IntegrationProviders.Telegram =>
                !string.IsNullOrWhiteSpace(IntegrationJson.Deserialize<TelegramIntegrationSecrets>(row.SecretsJson)?.BotToken)
                && !string.IsNullOrWhiteSpace(IntegrationJson.Deserialize<TelegramIntegrationConfig>(row.ConfigJson)?.ChatId),
            IntegrationProviders.Email =>
                !string.IsNullOrWhiteSpace(IntegrationJson.Deserialize<EmailIntegrationConfig>(row.ConfigJson)?.SmtpHost)
                && !string.IsNullOrWhiteSpace(IntegrationJson.Deserialize<EmailIntegrationSecrets>(row.SecretsJson)?.SmtpPassword),
            IntegrationProviders.GoogleCalendar =>
                !string.IsNullOrWhiteSpace(IntegrationJson.Deserialize<GoogleCalendarIntegrationSecrets>(row.SecretsJson)?.RefreshToken),
            _ => false,
        };
    }

    static string? BuildSummary(string provider, TenantIntegration? row)
    {
        if (row is null) return null;
        return provider switch
        {
            IntegrationProviders.Telegram =>
                IntegrationJson.Deserialize<TelegramIntegrationConfig>(row.ConfigJson)?.ChatId is { Length: > 0 } c
                    ? $"Chat {c}" : null,
            IntegrationProviders.Email =>
                IntegrationJson.Deserialize<EmailIntegrationConfig>(row.ConfigJson)?.FromEmail,
            IntegrationProviders.GoogleCalendar =>
                IntegrationJson.Deserialize<GoogleCalendarIntegrationConfig>(row.ConfigJson)?.ConnectedEmail
                    ?? (IsConfigured(provider, row) ? "Подключено" : null),
            _ => null,
        };
    }

    static IntegrationProviderDetailDto ToDetail(string provider, TenantIntegration row, bool googleOAuthConfigured)
    {
        object config = provider switch
        {
            IntegrationProviders.Telegram => IntegrationJson.Deserialize<TelegramIntegrationConfig>(row.ConfigJson) ?? new(),
            IntegrationProviders.Email => IntegrationJson.Deserialize<EmailIntegrationConfig>(row.ConfigJson) ?? new(),
            IntegrationProviders.GoogleCalendar => IntegrationJson.Deserialize<GoogleCalendarIntegrationConfig>(row.ConfigJson) ?? new(),
            _ => new { },
        };
        var secrets = row.SecretsJson;
        return new IntegrationProviderDetailDto
        {
            Id = provider,
            Name = DisplayNames[provider],
            IsEnabled = row.IsEnabled,
            IsConfigured = IsConfigured(provider, row),
            OauthServerConfigured = provider.Equals(IntegrationProviders.GoogleCalendar, StringComparison.OrdinalIgnoreCase)
                ? googleOAuthConfigured
                : null,
            Config = config,
            Secrets = new IntegrationSecretFlagsDto
            {
                HasBotToken = !string.IsNullOrWhiteSpace(IntegrationJson.Deserialize<TelegramIntegrationSecrets>(secrets)?.BotToken),
                HasSmtpPassword = !string.IsNullOrWhiteSpace(IntegrationJson.Deserialize<EmailIntegrationSecrets>(secrets)?.SmtpPassword),
                HasGoogleTokens = !string.IsNullOrWhiteSpace(IntegrationJson.Deserialize<GoogleCalendarIntegrationSecrets>(secrets)?.RefreshToken),
            },
        };
    }
}
