using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Services;

public enum BillingFeature
{
    Integrations,
    OpenApi,
    AutoTasks,
    AiAdvisor,
    AdvancedAnalytics,
    RoleManagement,
    Reports,
}

public sealed record BillingUsageDto(
    int Contacts,
    int ActiveSeats,
    int Pipelines,
    decimal StorageGb
);

public interface IBillingEntitlementsService
{
    Task<BillingPlanDefinition> GetPlanAsync(int tenantId, CancellationToken ct = default);
    Task<BillingUsageDto> GetUsageAsync(int tenantId, CancellationToken ct = default);
    Task<BillingCheckResult> EnsureCanAddContactAsync(int tenantId, CancellationToken ct = default);
    Task<BillingCheckResult> EnsureCanAddPipelineAsync(int tenantId, CancellationToken ct = default);
    Task<BillingCheckResult> EnsureFeatureAsync(int tenantId, BillingFeature feature, CancellationToken ct = default);
    Task<BillingCheckResult> EnsureCanCheckoutAsync(int tenantId, BillingPlanDefinition targetPlan, CancellationToken ct = default);
    Task<int> GetDefaultPipelineIdAsync(int tenantId, CancellationToken ct = default);
}

public sealed class BillingEntitlementsService(ExpogoDbContext db) : IBillingEntitlementsService
{
    public async Task<BillingPlanDefinition> GetPlanAsync(int tenantId, CancellationToken ct = default)
    {
        var sub = await db.BillingSubscriptions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
        var code = BillingPlans.NormalizePlanCode(sub?.PlanCode);
        return BillingPlans.Find(code)!;
    }

    public async Task<BillingUsageDto> GetUsageAsync(int tenantId, CancellationToken ct = default)
    {
        var contacts = await db.Clients.CountAsync(x => x.TenantId == tenantId, ct);
        var activeSeats = await db.TenantMemberships
            .Where(x => x.TenantId == tenantId)
            .Include(x => x.User)
            .CountAsync(x => !x.User.IsBlocked, ct);
        var pipelines = await db.SalesPipelines.CountAsync(x => x.TenantId == tenantId, ct);
        var storageMetric = await db.UsageMetrics.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.MetricKey == "storage_gb")
            .OrderByDescending(x => x.RecordedAtUtc)
            .Select(x => x.Value)
            .FirstOrDefaultAsync(ct);

        return new BillingUsageDto(contacts, activeSeats, pipelines, storageMetric);
    }

    public async Task<BillingCheckResult> EnsureCanAddContactAsync(int tenantId, CancellationToken ct = default)
    {
        var plan = await GetPlanAsync(tenantId, ct);
        if (BillingPlans.IsUnlimited(plan.ContactsLimit))
            return BillingCheckResult.Ok();

        var count = await db.Clients.CountAsync(x => x.TenantId == tenantId, ct);
        if (count >= plan.ContactsLimit)
            return BillingCheckResult.Deny(
                BillingLimitCodes.Contacts,
                $"Лимит контактов для тарифа {plan.Name}: {plan.ContactsLimit}.");

        return BillingCheckResult.Ok();
    }

    public async Task<BillingCheckResult> EnsureCanAddPipelineAsync(int tenantId, CancellationToken ct = default)
    {
        var plan = await GetPlanAsync(tenantId, ct);
        if (BillingPlans.IsUnlimited(plan.FunnelsLimit))
            return BillingCheckResult.Ok();

        var count = await db.SalesPipelines.CountAsync(x => x.TenantId == tenantId, ct);
        if (count >= plan.FunnelsLimit)
            return BillingCheckResult.Deny(
                BillingLimitCodes.Pipelines,
                $"Лимит воронок для тарифа {plan.Name}: {plan.FunnelsLimit}.");

        return BillingCheckResult.Ok();
    }

    public async Task<BillingCheckResult> EnsureFeatureAsync(int tenantId, BillingFeature feature, CancellationToken ct = default)
    {
        var plan = await GetPlanAsync(tenantId, ct);
        var allowed = feature switch
        {
            BillingFeature.Integrations or BillingFeature.OpenApi => plan.Integrations,
            BillingFeature.AutoTasks => plan.AutoTasks,
            BillingFeature.AiAdvisor => plan.AutoTasks,
            BillingFeature.AdvancedAnalytics => plan.AdvancedAnalytics,
            BillingFeature.RoleManagement => plan.RoleManagement,
            BillingFeature.Reports => plan.Code != "free",
            _ => false,
        };

        if (allowed)
            return BillingCheckResult.Ok();

        var code = feature switch
        {
            BillingFeature.Integrations or BillingFeature.OpenApi => BillingLimitCodes.Integrations,
            BillingFeature.AiAdvisor => BillingLimitCodes.AiAdvisor,
            BillingFeature.RoleManagement => BillingLimitCodes.TeamRoles,
            BillingFeature.Reports => BillingLimitCodes.Reports,
            _ => BillingLimitCodes.Integrations,
        };

        return BillingCheckResult.Deny(code, $"Функция недоступна на тарифе {plan.Name}.");
    }

    public async Task<BillingCheckResult> EnsureCanCheckoutAsync(int tenantId, BillingPlanDefinition targetPlan, CancellationToken ct = default)
    {
        var usage = await GetUsageAsync(tenantId, ct);

        if (targetPlan.Code == "team" && usage.ActiveSeats < targetPlan.MinSeats)
            return BillingCheckResult.Deny(
                BillingLimitCodes.TeamMinSeats,
                $"Тариф TEAM доступен от {targetPlan.MinSeats} активных участников команды.");

        if (!BillingPlans.IsUnlimited(targetPlan.ContactsLimit) && usage.Contacts > targetPlan.ContactsLimit)
            return BillingCheckResult.Deny(
                BillingLimitCodes.DowngradeUsage,
                $"Сократите базу контактов до {targetPlan.ContactsLimit} перед сменой тарифа.");

        if (!BillingPlans.IsUnlimited(targetPlan.FunnelsLimit) && usage.Pipelines > targetPlan.FunnelsLimit)
            return BillingCheckResult.Deny(
                BillingLimitCodes.DowngradeUsage,
                $"Удалите лишние воронки (максимум {targetPlan.FunnelsLimit}) перед сменой тарифа.");

        if (usage.ActiveSeats > targetPlan.SeatsLimit)
            return BillingCheckResult.Deny(
                BillingLimitCodes.Seats,
                $"Заблокируйте лишних пользователей: лимит мест {targetPlan.SeatsLimit}.");

        return BillingCheckResult.Ok();
    }

    public async Task<int> GetDefaultPipelineIdAsync(int tenantId, CancellationToken ct = default)
    {
        var pipeline = await db.SalesPipelines
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.Id)
            .FirstOrDefaultAsync(ct);

        if (pipeline is not null)
            return pipeline.Id;

        pipeline = new SalesPipeline
        {
            TenantId = tenantId,
            Name = "Основная",
            IsDefault = true,
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.SalesPipelines.Add(pipeline);
        await db.SaveChangesAsync(ct);
        return pipeline.Id;
    }
}
