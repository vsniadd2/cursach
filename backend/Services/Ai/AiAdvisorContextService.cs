using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace ExpogoCrm.Api.Services.Ai;

public sealed record AiAdvisorDealSnapshot(string Title, string Stage, decimal AmountUsd);

public sealed record AiAdvisorContext(
    string TenantName,
    string Tier,
    DateTime GeneratedAtUtc,
    int TotalDeals,
    int ClosedDeals,
    decimal ConversionPct,
    decimal MonthRevenueUsd,
    decimal? QuarterRevenueUsd,
    int OverdueTasks,
    int ClientCount,
    int OpenTasks,
    decimal? AvgClosedDealUsd,
    IReadOnlyList<AiAdvisorDealSnapshot> TopDeals,
    IReadOnlyList<ReportStageSlice> StageSlices,
    IReadOnlyList<ReportMonthRevenue> MonthlyRevenue);

public interface IAiAdvisorContextService
{
    Task<AiAdvisorContext> BuildAsync(int tenantId, CancellationToken ct = default);
    string ToJson(AiAdvisorContext context);
}

public sealed class AiAdvisorContextService(
    ExpogoDbContext db,
    IReportsAnalyticsService reports) : IAiAdvisorContextService
{
    public async Task<AiAdvisorContext> BuildAsync(int tenantId, CancellationToken ct = default)
    {
        var analytics = await reports.BuildAsync(tenantId, ct);
        var now = DateTime.UtcNow;

        var clientCount = await db.Clients.CountAsync(x => x.TenantId == tenantId, ct);
        var openTasks = await db.Tasks.CountAsync(
            x => x.TenantId == tenantId && !x.Done,
            ct);

        var closedAmounts = await db.Deals.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Stage == DealStage.Closed)
            .Select(x => x.Amount)
            .ToListAsync(ct);
        decimal? avgClosed = closedAmounts.Count == 0
            ? null
            : Math.Round(closedAmounts.Average(), 2);

        var topDeals = await db.Deals.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.Amount)
            .Take(3)
            .Select(x => new AiAdvisorDealSnapshot(
                x.Title,
                DealStageLabels.Label(x.Stage, "ru"),
                x.Amount))
            .ToListAsync(ct);

        return new AiAdvisorContext(
            analytics.TenantName,
            analytics.Tier,
            analytics.GeneratedAtUtc,
            analytics.TotalDeals,
            analytics.ClosedDeals,
            analytics.ConversionPct,
            analytics.MonthRevenueUsd,
            analytics.QuarterRevenueUsd,
            analytics.OverdueTasks,
            clientCount,
            openTasks,
            avgClosed,
            topDeals,
            analytics.StageSlices,
            analytics.MonthlyRevenue);
    }

    public string ToJson(AiAdvisorContext context) =>
        JsonSerializer.Serialize(context, new JsonSerializerOptions { WriteIndented = false });
}
