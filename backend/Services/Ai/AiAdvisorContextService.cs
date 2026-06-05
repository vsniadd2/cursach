using System.Text.Json;
using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Services.Ai;

public sealed record AiAdvisorContactInteraction(
    string ClientName,
    string Company,
    string Title,
    string? BodyPreview,
    DateTime OccurredAtUtc);

public sealed record AiAdvisorStageDuration(string Stage, double AvgDays, int Transitions);

public sealed record AiAdvisorDataGaps(
    string LossReasons,
    string ClientSatisfaction,
    string MarketingCampaigns);

public sealed record AiAdvisorDealSnapshot(string Title, string Stage, decimal AmountUsd);

public sealed record AiAdvisorPipelineSummary(
    string Name,
    bool IsDefault,
    int LeadCount,
    int NegotiationCount,
    int ClosedCount,
    decimal OpenAmountUsd);

public sealed record AiAdvisorOpenDealDetail(
    string Title,
    string ClientName,
    string Company,
    string Stage,
    decimal AmountUsd,
    int ProbabilityPct,
    DateTime? ExpectedCloseUtc,
    int DaysInStage,
    int DaysSinceCreated);

public sealed record AiAdvisorClosedDealDetail(
    string Title,
    string ClientName,
    decimal AmountUsd,
    DateTime ClosedAtUtc);

public sealed record AiAdvisorClientInsight(
    string FullName,
    string Company,
    int OpenDeals,
    int TotalDeals,
    decimal TotalAmountUsd,
    decimal OpenAmountUsd,
    DateTime? LastContactUtc,
    int DaysSinceLastContact);

public sealed record AiAdvisorTaskItem(
    string Title,
    string Priority,
    DateOnly DueDate,
    string? Assignee,
    bool Done);

public sealed record AiAdvisorActivityItem(string Title, string Description, DateTime AtUtc);

public sealed record AiAdvisorAuditHighlight(string Action, string EntityType, string EntityId, DateTime AtUtc);

public sealed record AiAdvisorTeamSnapshot(int TotalMembers, int Admins, int Managers, int Members);

public sealed record AiAdvisorIntegrationSnapshot(string Provider, bool IsEnabled, bool IsConfigured);

public sealed record AiAdvisorSupportSnapshot(int OpenTickets, IReadOnlyList<string> RecentSubjects);

/// <summary>Полный снимок CRM для LLM (JSON в system prompt).</summary>
public sealed record AiAdvisorContext(
    string TenantName,
    string Tier,
    string PlanCode,
    DateTime GeneratedAtUtc,
    int TotalDeals,
    int ClosedDeals,
    decimal ConversionPct,
    decimal MonthRevenueUsd,
    decimal? QuarterRevenueUsd,
    decimal? MonthRevenueGrowthPct,
    int OverdueTasks,
    int ClientCount,
    int NewClientsThisMonth,
    int OpenTasks,
    int TasksDueToday,
    decimal? AvgClosedDealUsd,
    decimal OpenPipelineUsd,
    decimal WeightedPipelineUsd,
    int DealsClosingWithin14Days,
    int StaleOpenDealsOver30Days,
    IReadOnlyList<AiAdvisorDealSnapshot> TopDeals,
    IReadOnlyList<ReportStageSlice> StageSlices,
    IReadOnlyList<ReportMonthRevenue> MonthlyRevenue,
    IReadOnlyList<AiAdvisorPipelineSummary> Pipelines,
    IReadOnlyList<AiAdvisorOpenDealDetail> OpenDeals,
    IReadOnlyList<AiAdvisorClosedDealDetail> RecentClosedDeals,
    IReadOnlyList<AiAdvisorClientInsight> ClientInsights,
    IReadOnlyList<AiAdvisorTaskItem> OverdueTaskList,
    IReadOnlyList<AiAdvisorTaskItem> UpcomingTasks,
    IReadOnlyList<AiAdvisorContactInteraction> RecentClientInteractions,
    IReadOnlyList<AiAdvisorActivityItem> RecentTeamActivity,
    IReadOnlyList<AiAdvisorAuditHighlight> RecentAuditHighlights,
    IReadOnlyList<AiAdvisorStageDuration> AvgDaysPerFunnelStage,
    AiAdvisorTeamSnapshot Team,
    IReadOnlyList<AiAdvisorIntegrationSnapshot> Integrations,
    AiAdvisorSupportSnapshot Support,
    AiAdvisorDataGaps DataNotAvailableInCrm);

public interface IAiAdvisorContextService
{
    Task<AiAdvisorContext> BuildAsync(int tenantId, CancellationToken ct = default);
    string ToJson(AiAdvisorContext context);
}

public sealed class AiAdvisorContextService(
    ExpogoDbContext db,
    IReportsAnalyticsService reports) : IAiAdvisorContextService
{
    const int MaxInteractions = 25;
    const int MaxOpenDeals = 40;
    const int MaxClosedDeals = 12;
    const int MaxClients = 15;
    const int MaxTasks = 12;
    const int MaxActivity = 15;
    const int MaxAudit = 20;
    const int StaleDealDays = 30;

    static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    static readonly AiAdvisorDataGaps DefaultDataGaps = new(
        LossReasons: "В CRM нет стадии «Проиграна» и поля «Причина отказа» — только Lead / Negotiation / Closed (успешное закрытие).",
        ClientSatisfaction: "Оценки удовлетворённости (NPS/CSAT) в системе не ведутся.",
        MarketingCampaigns: "Модуль маркетинговых кампаний и их ROI в системе отсутствует.");

    public async Task<AiAdvisorContext> BuildAsync(int tenantId, CancellationToken ct = default)
    {
        var analytics = await reports.BuildAsync(tenantId, ct);
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var prevMonthStart = monthStart.AddMonths(-1);
        var closeHorizon = now.AddDays(14);
        var staleCutoff = now.AddDays(-StaleDealDays);

        var tenant = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, ct);

        var monthRevenueGrowth = await ComputeMonthGrowthAsync(tenantId, monthStart, prevMonthStart, ct);

        var clientCount = await db.Clients.CountAsync(x => x.TenantId == tenantId, ct);
        var newClientsThisMonth = await db.Clients.CountAsync(
            x => x.TenantId == tenantId && x.CreatedAtUtc >= monthStart, ct);

        var openTasks = await db.Tasks.CountAsync(x => x.TenantId == tenantId && !x.Done, ct);
        var tasksDueToday = await db.Tasks.CountAsync(
            x => x.TenantId == tenantId && !x.Done && x.Date == today, ct);
        var overdueTasks = await db.Tasks.CountAsync(
            x => x.TenantId == tenantId && !x.Done && x.Date < today, ct);

        var openDealsQuery = db.Deals.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Stage != DealStage.Closed);

        var openPipelineUsd = await openDealsQuery.SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var weightedPipelineUsd = await openDealsQuery
            .SumAsync(x => (decimal?)(x.Amount * x.ProbabilityPct / 100m), ct) ?? 0m;

        var dealsClosingSoon = await openDealsQuery.CountAsync(
            x => x.ExpectedCloseDateUtc != null && x.ExpectedCloseDateUtc <= closeHorizon, ct);

        var staleOpenDeals = await openDealsQuery.CountAsync(x => x.CreatedAtUtc <= staleCutoff, ct);

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
            .Take(5)
            .Select(x => new AiAdvisorDealSnapshot(
                x.Title,
                DealStageLabels.Label(x.Stage, "ru"),
                x.Amount))
            .ToListAsync(ct);

        var stageSinceMap = await BuildDealStageSinceMapAsync(tenantId, ct);

        var openDeals = await openDealsQuery
            .OrderByDescending(x => x.Amount)
            .Take(MaxOpenDeals)
            .Select(x => new
            {
                x.Id,
                x.Title,
                ClientName = x.Client.FullName,
                Company = x.Client.Company,
                x.Stage,
                x.Amount,
                x.ProbabilityPct,
                x.ExpectedCloseDateUtc,
                x.CreatedAtUtc,
            })
            .ToListAsync(ct);

        var openDealDetails = openDeals.Select(x =>
        {
            var stageSince = stageSinceMap.GetValueOrDefault(x.Id, x.CreatedAtUtc);
            return new AiAdvisorOpenDealDetail(
                x.Title,
                x.ClientName,
                x.Company,
                DealStageLabels.Label(x.Stage, "ru"),
                x.Amount,
                x.ProbabilityPct,
                x.ExpectedCloseDateUtc,
                Math.Max(0, (int)(now - stageSince).TotalDays),
                Math.Max(0, (int)(now - x.CreatedAtUtc).TotalDays));
        }).ToList();

        var recentClosed = await db.Deals.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Stage == DealStage.Closed)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(MaxClosedDeals)
            .Select(x => new AiAdvisorClosedDealDetail(
                x.Title,
                x.Client.FullName,
                x.Amount,
                x.CreatedAtUtc))
            .ToListAsync(ct);

        var pipelines = await LoadPipelinesAsync(tenantId, ct);
        var clientInsights = await LoadClientInsightsAsync(tenantId, now, ct);
        var overdueTaskList = await LoadTasksAsync(tenantId, overdue: true, today, ct);
        var upcomingTasks = await LoadTasksAsync(tenantId, overdue: false, today, ct);
        var interactions = await LoadRecentInteractionsAsync(tenantId, ct);
        var activities = await LoadActivityAsync(tenantId, ct);
        var auditHighlights = await LoadAuditHighlightsAsync(tenantId, ct);
        var stageDurations = await ComputeStageDurationsAsync(tenantId, ct);
        var team = await LoadTeamAsync(tenantId, ct);
        var integrations = await LoadIntegrationsAsync(tenantId, ct);
        var support = await LoadSupportAsync(tenantId, ct);

        return new AiAdvisorContext(
            analytics.TenantName,
            analytics.Tier,
            tenant.PlanCode,
            analytics.GeneratedAtUtc,
            analytics.TotalDeals,
            analytics.ClosedDeals,
            analytics.ConversionPct,
            analytics.MonthRevenueUsd,
            analytics.QuarterRevenueUsd,
            monthRevenueGrowth,
            overdueTasks,
            clientCount,
            newClientsThisMonth,
            openTasks,
            tasksDueToday,
            avgClosed,
            Math.Round(openPipelineUsd, 2),
            Math.Round(weightedPipelineUsd, 2),
            dealsClosingSoon,
            staleOpenDeals,
            topDeals,
            analytics.StageSlices,
            analytics.MonthlyRevenue,
            pipelines,
            openDealDetails,
            recentClosed,
            clientInsights,
            overdueTaskList,
            upcomingTasks,
            interactions,
            activities,
            auditHighlights,
            stageDurations,
            team,
            integrations,
            support,
            DefaultDataGaps);
    }

    public string ToJson(AiAdvisorContext context) => JsonSerializer.Serialize(context, JsonOpts);

    async Task<decimal?> ComputeMonthGrowthAsync(
        int tenantId,
        DateTime monthStart,
        DateTime prevMonthStart,
        CancellationToken ct)
    {
        var monthSales = await db.Deals.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Stage == DealStage.Closed && x.CreatedAtUtc >= monthStart)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var prevMonthSales = await db.Deals.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.Stage == DealStage.Closed
                && x.CreatedAtUtc >= prevMonthStart && x.CreatedAtUtc < monthStart)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;

        if (prevMonthSales == 0m)
            return monthSales == 0m ? null : 100m;
        return Math.Round((monthSales - prevMonthSales) / prevMonthSales * 100m, 1);
    }

    async Task<IReadOnlyList<AiAdvisorPipelineSummary>> LoadPipelinesAsync(int tenantId, CancellationToken ct)
    {
        var rows = await db.SalesPipelines.AsNoTracking()
            .Where(p => p.TenantId == tenantId)
            .Select(p => new
            {
                p.Name,
                p.IsDefault,
                Deals = p.Deals.Select(d => new { d.Stage, d.Amount }).ToList(),
            })
            .ToListAsync(ct);

        return rows.Select(p => new AiAdvisorPipelineSummary(
            p.Name,
            p.IsDefault,
            p.Deals.Count(d => d.Stage == DealStage.Lead),
            p.Deals.Count(d => d.Stage == DealStage.Negotiation),
            p.Deals.Count(d => d.Stage == DealStage.Closed),
            Math.Round(p.Deals.Where(d => d.Stage != DealStage.Closed).Sum(d => d.Amount), 2))).ToList();
    }

    async Task<IReadOnlyList<AiAdvisorClientInsight>> LoadClientInsightsAsync(
        int tenantId,
        DateTime now,
        CancellationToken ct)
    {
        var clients = await db.Clients.AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .Select(c => new
            {
                c.FullName,
                c.Company,
                Deals = c.Deals.Select(d => new { d.Stage, d.Amount }).ToList(),
                LastContact = c.ContactEvents.Max(e => (DateTime?)e.OccurredAtUtc),
            })
            .ToListAsync(ct);

        return clients
            .Select(c =>
            {
                var open = c.Deals.Where(d => d.Stage != DealStage.Closed).ToList();
                var daysSince = c.LastContact is null
                    ? (int?)null
                    : Math.Max(0, (int)(now - c.LastContact.Value).TotalDays);
                return new AiAdvisorClientInsight(
                    c.FullName,
                    c.Company,
                    open.Count,
                    c.Deals.Count,
                    Math.Round(c.Deals.Sum(d => d.Amount), 2),
                    Math.Round(open.Sum(d => d.Amount), 2),
                    c.LastContact,
                    daysSince ?? -1);
            })
            .OrderByDescending(c => c.OpenAmountUsd)
            .ThenByDescending(c => c.TotalAmountUsd)
            .Take(MaxClients)
            .ToList();
    }

    async Task<IReadOnlyList<AiAdvisorTaskItem>> LoadTasksAsync(
        int tenantId,
        bool overdue,
        DateOnly today,
        CancellationToken ct)
    {
        var weekEnd = today.AddDays(7);
        var query = db.Tasks.AsNoTracking().Where(t => t.TenantId == tenantId && !t.Done);

        query = overdue
            ? query.Where(t => t.Date < today)
            : query.Where(t => t.Date >= today && t.Date <= weekEnd);

        return await query
            .OrderBy(t => t.Date)
            .ThenByDescending(t => t.Priority)
            .Take(MaxTasks)
            .Select(t => new AiAdvisorTaskItem(
                t.Title,
                t.Priority.ToString(),
                t.Date,
                t.AssigneeName,
                t.Done))
            .ToListAsync(ct);
    }

    async Task<IReadOnlyList<AiAdvisorContactInteraction>> LoadRecentInteractionsAsync(
        int tenantId,
        CancellationToken ct)
    {
        return await db.ContactEvents.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.OccurredAtUtc)
            .Take(MaxInteractions)
            .Select(x => new AiAdvisorContactInteraction(
                x.Client.FullName,
                x.Client.Company,
                x.Title,
                x.Body != null && x.Body.Length > 200 ? x.Body.Substring(0, 200) + "…" : x.Body,
                x.OccurredAtUtc))
            .ToListAsync(ct);
    }

    async Task<IReadOnlyList<AiAdvisorActivityItem>> LoadActivityAsync(int tenantId, CancellationToken ct)
    {
        return await db.ActivityEvents.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(MaxActivity)
            .Select(x => new AiAdvisorActivityItem(
                x.Title,
                x.Description.Length > 180 ? x.Description.Substring(0, 180) + "…" : x.Description,
                x.CreatedAtUtc))
            .ToListAsync(ct);
    }

    async Task<IReadOnlyList<AiAdvisorAuditHighlight>> LoadAuditHighlightsAsync(int tenantId, CancellationToken ct)
    {
        return await db.AuditLogs.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(MaxAudit)
            .Select(x => new AiAdvisorAuditHighlight(x.Action, x.EntityType, x.EntityId, x.CreatedAtUtc))
            .ToListAsync(ct);
    }

    async Task<AiAdvisorTeamSnapshot> LoadTeamAsync(int tenantId, CancellationToken ct)
    {
        var roles = await db.TenantMemberships.AsNoTracking()
            .Where(m => m.TenantId == tenantId)
            .Select(m => m.Role)
            .ToListAsync(ct);

        return new AiAdvisorTeamSnapshot(
            roles.Count,
            roles.Count(r => r is TenantRole.Owner or TenantRole.Admin),
            roles.Count(r => r == TenantRole.Manager),
            roles.Count(r => r is TenantRole.Member or TenantRole.Viewer));
    }

    async Task<IReadOnlyList<AiAdvisorIntegrationSnapshot>> LoadIntegrationsAsync(int tenantId, CancellationToken ct)
    {
        var rows = await db.TenantIntegrations.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new { x.Provider, x.IsEnabled, x.ConfigJson, x.SecretsJson })
            .ToListAsync(ct);

        return rows.Select(x => new AiAdvisorIntegrationSnapshot(
            x.Provider,
            x.IsEnabled,
            !string.IsNullOrWhiteSpace(x.ConfigJson) || !string.IsNullOrWhiteSpace(x.SecretsJson))).ToList();
    }

    async Task<AiAdvisorSupportSnapshot> LoadSupportAsync(int tenantId, CancellationToken ct)
    {
        var open = await db.SupportTickets.AsNoTracking()
            .CountAsync(x => x.TenantId == tenantId && x.Status == "open", ct);

        var subjects = await db.SupportTickets.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(5)
            .Select(x => x.Subject)
            .ToListAsync(ct);

        return new AiAdvisorSupportSnapshot(open, subjects);
    }

    async Task<Dictionary<int, DateTime>> BuildDealStageSinceMapAsync(int tenantId, CancellationToken ct)
    {
        var deals = await db.Deals.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new { x.Id, x.CreatedAtUtc })
            .ToListAsync(ct);

        if (deals.Count == 0)
            return [];

        var dealIds = deals.Select(x => x.Id.ToString()).ToHashSet(StringComparer.Ordinal);
        var auditRows = await db.AuditLogs.AsNoTracking()
            .Where(x =>
                x.TenantId == tenantId
                && x.EntityType == nameof(Deal)
                && (x.Action == "deals.create" || x.Action == "deals.update" || x.Action == "deals.stage"))
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new { x.EntityId, x.Action, x.BeforeJson, x.AfterJson, x.CreatedAtUtc })
            .ToListAsync(ct);

        var map = deals.ToDictionary(d => d.Id, d => d.CreatedAtUtc);

        foreach (var group in auditRows.Where(x => dealIds.Contains(x.EntityId)).GroupBy(x => x.EntityId))
        {
            if (!int.TryParse(group.Key, out var dealId))
                continue;

            DateTime? lastStageChange = null;
            foreach (var log in group.OrderBy(x => x.CreatedAtUtc))
            {
                if (ResolveStageFromAudit(log.Action, log.BeforeJson, log.AfterJson) is not null)
                    lastStageChange = log.CreatedAtUtc;
            }

            if (lastStageChange is not null)
                map[dealId] = lastStageChange.Value;
        }

        return map;
    }

    async Task<IReadOnlyList<AiAdvisorStageDuration>> ComputeStageDurationsAsync(
        int tenantId,
        CancellationToken ct)
    {
        var deals = await db.Deals.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => new { x.Id, x.Stage, x.CreatedAtUtc })
            .ToListAsync(ct);

        if (deals.Count == 0)
            return [];

        var dealIds = deals.Select(x => x.Id.ToString()).ToHashSet(StringComparer.Ordinal);
        var auditRows = await db.AuditLogs.AsNoTracking()
            .Where(x =>
                x.TenantId == tenantId
                && x.EntityType == nameof(Deal)
                && (x.Action == "deals.create" || x.Action == "deals.update" || x.Action == "deals.stage"))
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new { x.EntityId, x.Action, x.BeforeJson, x.AfterJson, x.CreatedAtUtc })
            .ToListAsync(ct);

        var auditsByDeal = auditRows
            .Where(x => dealIds.Contains(x.EntityId))
            .GroupBy(x => x.EntityId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var totals = new Dictionary<DealStage, (double SumDays, int Count)>();
        var now = DateTime.UtcNow;

        foreach (var deal in deals)
        {
            var key = deal.Id.ToString();
            var points = new List<(DealStage Stage, DateTime At)>();

            if (auditsByDeal.TryGetValue(key, out var logs))
            {
                foreach (var log in logs)
                {
                    var stage = ResolveStageFromAudit(log.Action, log.BeforeJson, log.AfterJson);
                    if (stage is not null)
                        points.Add((stage.Value, log.CreatedAtUtc));
                }
            }

            points = points.OrderBy(p => p.At).ToList();
            if (points.Count == 0)
                points.Add((deal.Stage, deal.CreatedAtUtc));
            else if (points[0].At > deal.CreatedAtUtc)
                points.Insert(0, (points[0].Stage, deal.CreatedAtUtc));

            points.Add((deal.Stage, now));

            for (var i = 0; i < points.Count - 1; i++)
            {
                var stage = points[i].Stage;
                var days = (points[i + 1].At - points[i].At).TotalDays;
                if (days < 0.01)
                    continue;
                if (!totals.TryGetValue(stage, out var acc))
                    acc = (0, 0);
                totals[stage] = (acc.SumDays + days, acc.Count + 1);
            }
        }

        return totals
            .OrderBy(x => x.Key)
            .Select(x => new AiAdvisorStageDuration(
                DealStageLabels.Label(x.Key, "ru"),
                Math.Round(x.Value.SumDays / x.Value.Count, 1),
                x.Value.Count))
            .ToList();
    }

    static DealStage? ResolveStageFromAudit(string action, string? beforeJson, string? afterJson)
    {
        if (action == "deals.stage")
            return ParseStageJson(afterJson) ?? ParseStageJson(beforeJson);

        if (action is "deals.create" or "deals.update")
            return ParseStageJson(afterJson);

        return null;
    }

    static DealStage? ParseStageJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("stage", out var stageEl)
                && !doc.RootElement.TryGetProperty("Stage", out stageEl))
                return null;

            var raw = stageEl.ValueKind == JsonValueKind.String
                ? stageEl.GetString()
                : stageEl.ToString();
            if (string.IsNullOrWhiteSpace(raw))
                return null;

            return Enum.TryParse<DealStage>(raw, true, out var stage) ? stage : null;
        }
        catch
        {
            return null;
        }
    }
}
