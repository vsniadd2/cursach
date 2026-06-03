using ExpogoCrm.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Services;

public sealed record ReportStageSlice(string Stage, string Label, int Count);

public sealed record ReportMonthRevenue(string Label, int Year, int Month, decimal AmountUsd);

public sealed record ReportAnalytics(
    string TenantName,
    string Tier,
    DateTime GeneratedAtUtc,
    int TotalDeals,
    int ClosedDeals,
    decimal ConversionPct,
    decimal MonthRevenueUsd,
    decimal? QuarterRevenueUsd,
    int OverdueTasks,
    IReadOnlyList<ReportStageSlice> StageSlices,
    IReadOnlyList<ReportMonthRevenue> MonthlyRevenue);

public interface IReportsAnalyticsService
{
    Task<ReportAnalytics> BuildAsync(int tenantId, CancellationToken ct = default);
}

public sealed class ReportsAnalyticsService(ExpogoDbContext db, IBillingEntitlementsService billing) : IReportsAnalyticsService
{
    public async Task<ReportAnalytics> BuildAsync(int tenantId, CancellationToken ct = default)
    {
        var plan = await billing.GetPlanAsync(tenantId, ct);
        var tenant = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, ct);
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var quarterStart = monthStart.AddMonths(-2);

        var totalDeals = await db.Deals.CountAsync(x => x.TenantId == tenantId, ct);
        var closedDeals = await db.Deals.CountAsync(x => x.TenantId == tenantId && x.Stage == DealStage.Closed, ct);
        var monthRevenueUsd = await db.Deals
            .Where(x => x.TenantId == tenantId && x.Stage == DealStage.Closed && x.CreatedAtUtc >= monthStart)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        decimal? quarterRevenueUsd = null;
        if (plan.AdvancedAnalytics)
        {
            quarterRevenueUsd = await db.Deals
                .Where(x => x.TenantId == tenantId && x.Stage == DealStage.Closed && x.CreatedAtUtc >= quarterStart)
                .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        }

        var conversion = totalDeals == 0 ? 0m : Math.Round((decimal)closedDeals / totalDeals * 100m, 2);
        var overdueTasks = await db.Tasks.CountAsync(
            x => x.TenantId == tenantId && !x.Done && x.Date < DateOnly.FromDateTime(now),
            ct);

        var lead = await db.Deals.CountAsync(x => x.TenantId == tenantId && x.Stage == DealStage.Lead, ct);
        var negotiation = await db.Deals.CountAsync(x => x.TenantId == tenantId && x.Stage == DealStage.Negotiation, ct);
        var closed = await db.Deals.CountAsync(x => x.TenantId == tenantId && x.Stage == DealStage.Closed, ct);

        var stageSlices = new List<ReportStageSlice>
        {
            new("Lead", "Лиды", lead),
            new("Negotiation", "Переговоры", negotiation),
            new("Closed", "Закрыты", closed),
        };

        var months = new List<ReportMonthRevenue>();
        for (var i = 5; i >= 0; i--)
        {
            var start = monthStart.AddMonths(-i);
            var end = start.AddMonths(1);
            var amount = await db.Deals
                .Where(x =>
                    x.TenantId == tenantId
                    && x.Stage == DealStage.Closed
                    && x.CreatedAtUtc >= start
                    && x.CreatedAtUtc < end)
                .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
            months.Add(new ReportMonthRevenue(start.ToString("MMM yyyy"), start.Year, start.Month, amount));
        }

        var tier = plan.AdvancedAnalytics ? "advanced" : "standard";

        return new ReportAnalytics(
            tenant.Name,
            tier,
            now,
            totalDeals,
            closedDeals,
            conversion,
            monthRevenueUsd,
            quarterRevenueUsd,
            overdueTasks,
            stageSlices,
            months);
    }
}
