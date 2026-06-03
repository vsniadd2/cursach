using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace ExpogoCrm.Api.Services.Integrations;

public interface ITelegramIntegrationClient
{
    Task SendAsync(string botToken, string chatId, string text, CancellationToken ct = default);
}

public sealed class TelegramIntegrationClient(IHttpClientFactory httpFactory) : ITelegramIntegrationClient
{
    public async Task SendAsync(string botToken, string chatId, string text, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(botToken) || string.IsNullOrWhiteSpace(chatId))
            throw new InvalidOperationException("Укажите Bot Token и Chat ID.");

        var http = httpFactory.CreateClient(nameof(TelegramIntegrationClient));
        var url = $"https://api.telegram.org/bot{botToken.Trim()}/sendMessage";
        using var res = await http.PostAsJsonAsync(
            url,
            new { chat_id = chatId.Trim(), text, parse_mode = "HTML" },
            ct);

        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Telegram API: {body}");
        }

        var parsed = await res.Content.ReadFromJsonAsync<TelegramResponse>(cancellationToken: ct);
        if (parsed?.Ok != true)
            throw new InvalidOperationException(parsed?.Description ?? "Telegram API error");
    }

    sealed class TelegramResponse
    {
        [JsonPropertyName("ok")]
        public bool Ok { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }
    }
}
