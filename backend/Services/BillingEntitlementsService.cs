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
    decimal StorageGb);

public sealed record StorageQuotaDto(
    int StorageGbPerSeat,
    int ActiveSeats,
    decimal StorageGbTotalLimit,
    decimal StorageGbUsed,
    long LimitBytes,
    long UsedBytes);

public interface IBillingEntitlementsService
{
    Task<BillingPlanDefinition> GetPlanAsync(int tenantId, CancellationToken ct = default);
    Task<BillingUsageDto> GetUsageAsync(int tenantId, CancellationToken ct = default);
    Task<StorageQuotaDto> GetStorageQuotaAsync(int tenantId, CancellationToken ct = default);
    Task<BillingCheckResult> EnsureCanUploadStorageAsync(int tenantId, long additionalBytes, CancellationToken ct = default);
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
        var activeSeats = await CountActiveSeatsAsync(tenantId, ct);
        var pipelines = await db.SalesPipelines.CountAsync(x => x.TenantId == tenantId, ct);
        var usedBytes = await SumStorageBytesAsync(tenantId, ct);
        var storageGb = BytesToGb(usedBytes);

        return new BillingUsageDto(contacts, activeSeats, pipelines, storageGb);
    }

    public async Task<StorageQuotaDto> GetStorageQuotaAsync(int tenantId, CancellationToken ct = default)
    {
        var plan = await GetPlanAsync(tenantId, ct);
        var activeSeats = await CountActiveSeatsAsync(tenantId, ct);
        var usedBytes = await SumStorageBytesAsync(tenantId, ct);
        var limitBytes = BillingPlans.TotalStorageBytes(plan.StorageGbLimit, activeSeats);

        return new StorageQuotaDto(
            plan.StorageGbLimit,
            activeSeats,
            BillingPlans.TotalStorageGb(plan.StorageGbLimit, activeSeats),
            BytesToGb(usedBytes),
            limitBytes,
            usedBytes);
    }

    public async Task<BillingCheckResult> EnsureCanUploadStorageAsync(int tenantId, long additionalBytes, CancellationToken ct = default)
    {
        if (additionalBytes <= 0)
            return BillingCheckResult.Ok();

        var quota = await GetStorageQuotaAsync(tenantId, ct);
        if (quota.UsedBytes + additionalBytes > quota.LimitBytes)
        {
            return BillingCheckResult.Deny(
                BillingLimitCodes.Storage,
                $"Лимит облачного диска: {quota.StorageGbTotalLimit} ГБ " +
                $"({quota.StorageGbPerSeat} ГБ × {quota.ActiveSeats} сотр.). " +
                $"Занято {quota.StorageGbUsed} ГБ.");
        }

        return BillingCheckResult.Ok();
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
        var quota = await GetStorageQuotaAsync(tenantId, ct);
        var targetLimitBytes = BillingPlans.TotalStorageBytes(targetPlan.StorageGbLimit, usage.ActiveSeats);

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

        if (quota.UsedBytes > targetLimitBytes)
        {
            var targetGb = BillingPlans.TotalStorageGb(targetPlan.StorageGbLimit, usage.ActiveSeats);
            return BillingCheckResult.Deny(
                BillingLimitCodes.DowngradeUsage,
                $"Освободите облачный диск до {targetGb} ГБ перед сменой тарифа.");
        }

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

    async Task<int> CountActiveSeatsAsync(int tenantId, CancellationToken ct) =>
        await db.TenantMemberships
            .Where(x => x.TenantId == tenantId)
            .Include(x => x.User)
            .CountAsync(x => !x.User.IsBlocked, ct);

    async Task<long> SumStorageBytesAsync(int tenantId, CancellationToken ct) =>
        await db.TenantCloudFiles
            .Where(x => x.TenantId == tenantId)
            .SumAsync(x => (long?)x.SizeBytes, ct) ?? 0L;

    static decimal BytesToGb(long bytes) =>
        Math.Round(bytes / (1024m * 1024m * 1024m), 2);
}
