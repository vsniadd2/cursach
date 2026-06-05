using System.Text.Json;
using System.Text.Json.Serialization;

namespace ExpogoCrm.Api.Services.Integrations;

public static class IntegrationJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static T? Deserialize<T>(string? json) where T : class =>
        string.IsNullOrWhiteSpace(json) ? null : JsonSerializer.Deserialize<T>(json, Options);

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);
}

public sealed class TelegramIntegrationConfig
{
    public string ChatId { get; set; } = "";
    public bool NotifyDealClosed { get; set; } = true;
    public bool NotifyTaskOverdue { get; set; } = true;
    public bool NotifyNewClient { get; set; }
}

public sealed class TelegramIntegrationSecrets
{
    public string BotToken { get; set; } = "";
}

public sealed class EmailIntegrationConfig
{
    public string SmtpHost { get; set; } = "";
    public int SmtpPort { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string SmtpUser { get; set; } = "";
    public string FromEmail { get; set; } = "";
    public string FromName { get; set; } = "Expogo CRM";
    public bool NotifyDealClosed { get; set; } = true;
    public bool NotifyTaskOverdue { get; set; } = true;
    public bool NotifyNewClient { get; set; }
}

public sealed class EmailIntegrationSecrets
{
    public string SmtpPassword { get; set; } = "";
}

public sealed class GoogleCalendarIntegrationConfig
{
    public string CalendarId { get; set; } = "primary";
    public string? ConnectedEmail { get; set; }
    public bool SyncTasks { get; set; } = true;
}

public sealed class GoogleCalendarIntegrationSecrets
{
    public string? RefreshToken { get; set; }
    public string? AccessToken { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
}

public sealed class IntegrationProviderSummaryDto
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public bool IsEnabled { get; init; }
    public bool IsConfigured { get; init; }
    public string? Summary { get; init; }
}

public sealed class IntegrationProviderDetailDto
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public bool IsEnabled { get; init; }
    public bool IsConfigured { get; init; }
    /// <summary>Google Calendar: OAuth client настроен на сервере (ClientId + Secret).</summary>
    public bool? OauthServerConfigured { get; init; }
    public object Config { get; init; } = new { };
    public IntegrationSecretFlagsDto Secrets { get; init; } = new();
}

public sealed class IntegrationSecretFlagsDto
{
    public bool HasBotToken { get; init; }
    public bool HasSmtpPassword { get; init; }
    public bool HasGoogleTokens { get; init; }
}

public sealed class UpdateIntegrationRequest
{
    public bool? IsEnabled { get; set; }
    public JsonElement? Config { get; set; }
    public JsonElement? Secrets { get; set; }
}
