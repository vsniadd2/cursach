using System.Text;
using System.Text.Json;
using ExpogoCrm.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Services;

public sealed class IntegrationJobsWorker(
    IServiceScopeFactory scopeFactory,
    IHttpClientFactory httpFactory,
    ILogger<IntegrationJobsWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ExpogoDbContext>();
                var http = httpFactory.CreateClient(nameof(IntegrationJobsWorker));
                http.Timeout = TimeSpan.FromSeconds(45);

                var now = DateTime.UtcNow;
                var jobs = await db.IntegrationJobs
                    .Where(x => x.Status == IntegrationJobStatus.Pending && x.ScheduledAtUtc <= now)
                    .OrderBy(x => x.ScheduledAtUtc)
                    .Take(20)
                    .ToListAsync(stoppingToken);

                foreach (var job in jobs)
                {
                    job.Status = IntegrationJobStatus.Processing;
                }

                await db.SaveChangesAsync(stoppingToken);

                foreach (var job in jobs)
                {
                    try
                    {
                        if (string.Equals(job.JobType, "webhook", StringComparison.OrdinalIgnoreCase))
                            await DeliverWebhookAsync(http, job, stoppingToken);
                        else
                            await Task.Delay(20, stoppingToken);

                        job.Status = IntegrationJobStatus.Succeeded;
                        job.ProcessedAtUtc = DateTime.UtcNow;
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "Integration job {JobId} failed (attempt {Attempt})", job.Id, job.Attempts + 1);
                        job.Attempts += 1;
                        job.LastError = ex.Message;
                        job.Status = job.Attempts >= 5 ? IntegrationJobStatus.Failed : IntegrationJobStatus.Pending;
                        job.ScheduledAtUtc = DateTime.UtcNow.AddSeconds(Math.Pow(2, Math.Min(job.Attempts, 6)));
                    }
                }

                await db.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "IntegrationJobsWorker iteration failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
        }
    }

    private static async Task DeliverWebhookAsync(HttpClient http, IntegrationJob job, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(job.PayloadJson))
            throw new InvalidOperationException("PayloadJson обязателен для webhook (JSON с полем url).");

        using var doc = JsonDocument.Parse(job.PayloadJson);
        var root = doc.RootElement;
        if (!root.TryGetProperty("url", out var urlEl) || urlEl.ValueKind != JsonValueKind.String)
            throw new InvalidOperationException("Payload должен содержать строковое поле url.");

        var url = urlEl.GetString();
        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException("url пустой.");

        using var req = new HttpRequestMessage(HttpMethod.Post, url);

        if (root.TryGetProperty("method", out var mEl) && mEl.ValueKind == JsonValueKind.String)
        {
            var m = mEl.GetString()?.Trim().ToUpperInvariant();
            if (m is "GET" or "HEAD")
                req.Method = new HttpMethod(m);
        }

        if (root.TryGetProperty("headers", out var headersEl) && headersEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var p in headersEl.EnumerateObject())
            {
                if (string.IsNullOrWhiteSpace(p.Name) || p.Value.ValueKind != JsonValueKind.String)
                    continue;
                var v = p.Value.GetString();
                if (v is null)
                    continue;
                if (p.Name.Equals("Content-Type", StringComparison.OrdinalIgnoreCase)) continue;
                req.Headers.TryAddWithoutValidation(p.Name, v);
            }
        }

        if (req.Method != HttpMethod.Get && req.Method != HttpMethod.Head &&
            root.TryGetProperty("body", out var bodyEl))
        {
            var bodyStr = bodyEl.ValueKind == JsonValueKind.String ? bodyEl.GetString() : bodyEl.GetRawText();
            if (!string.IsNullOrEmpty(bodyStr))
            {
                var mediaType = root.TryGetProperty("contentType", out var ctEl) && ctEl.ValueKind == JsonValueKind.String
                    ? ctEl.GetString()
                    : "application/json";
                req.Content = new StringContent(bodyStr, Encoding.UTF8, mediaType ?? "application/json");
            }
        }

        using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        resp.EnsureSuccessStatusCode();
    }
}
