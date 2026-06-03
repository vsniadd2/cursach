using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace ExpogoCrm.Api.Services;

public record FxRatesSnapshot(string Base, IReadOnlyDictionary<string, decimal> Rates, DateTime UpdatedAtUtc);

public interface IFxRatesService
{
    Task<FxRatesSnapshot> GetRatesAsync(CancellationToken ct = default);
}

public class FxRatesService(IHttpClientFactory httpClientFactory, IMemoryCache cache) : IFxRatesService
{
    private const string CacheKey = "fx:rates:usd";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(24);

    public static readonly string[] SupportedCurrencies =
    [
        "USD", "BYN", "RUB", "EUR", "UAH", "GBP", "CNY", "JPY", "CHF", "PLN",
    ];

    public async Task<FxRatesSnapshot> GetRatesAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(CacheKey, out FxRatesSnapshot? cached) && cached is not null)
            return cached;

        try
        {
            var fetched = await FetchFromFrankfurterAsync(ct);
            cache.Set(CacheKey, fetched, CacheTtl);
            cache.Set($"{CacheKey}:stale", fetched);
            return fetched;
        }
        catch (HttpRequestException)
        {
            if (cache.TryGetValue($"{CacheKey}:stale", out FxRatesSnapshot? stale) && stale is not null)
                return stale;
            throw;
        }
    }

    private async Task<FxRatesSnapshot> FetchFromFrankfurterAsync(CancellationToken ct)
    {
        const string url = "https://open.er-api.com/v6/latest/USD";

        var client = httpClientFactory.CreateClient(nameof(FxRatesService));
        using var response = await client.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var rates = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase) { ["USD"] = 1m };
        if (doc.RootElement.TryGetProperty("rates", out var ratesEl))
        {
            foreach (var code in SupportedCurrencies)
            {
                if (code == "USD") continue;
                if (ratesEl.TryGetProperty(code, out var valueEl) && valueEl.TryGetDecimal(out var value))
                    rates[code] = value;
            }
        }

        var updatedAt = doc.RootElement.TryGetProperty("time_last_update_utc", out var updatedEl)
            && DateTime.TryParse(updatedEl.GetString(), out var parsed)
            ? DateTime.SpecifyKind(parsed, DateTimeKind.Utc)
            : DateTime.UtcNow;

        return new FxRatesSnapshot("USD", rates, updatedAt);
    }
}
