using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("billing")]
[Authorize]
public class BillingController(ExpogoDbContext db, IAuditTrailService audit) : ControllerBase
{
    [HttpGet("subscription")]
    [Authorize(Policy = CrmPermissions.BillingRead)]
    public async Task<ActionResult<object>> Subscription(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var sub = await db.BillingSubscriptions.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (sub is null) return NotFound(new { message = "Подписка не найдена" });
        return Ok(new
        {
            sub.Id,
            sub.TenantId,
            sub.PlanCode,
            sub.Status,
            sub.SeatsLimit,
            sub.StorageGbLimit,
            sub.CurrentPeriodStartUtc,
            sub.CurrentPeriodEndUtc
        });
    }

    public sealed class UpdateSubscriptionRequest
    {
        public string PlanCode { get; set; } = "starter";
        public int SeatsLimit { get; set; } = 5;
        public int StorageGbLimit { get; set; } = 5;
    }

    [HttpPatch("subscription")]
    [Authorize(Policy = CrmPermissions.BillingWrite)]
    public async Task<ActionResult> UpdateSubscription([FromBody] UpdateSubscriptionRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var sub = await db.BillingSubscriptions.SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (sub is null) return NotFound(new { message = "Подписка не найдена" });
        var before = new { sub.PlanCode, sub.SeatsLimit, sub.StorageGbLimit };
        sub.PlanCode = string.IsNullOrWhiteSpace(req.PlanCode) ? "starter" : req.PlanCode.Trim().ToLowerInvariant();
        sub.SeatsLimit = Math.Max(1, req.SeatsLimit);
        sub.StorageGbLimit = Math.Max(1, req.StorageGbLimit);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(tenantId, "billing.subscription.update", nameof(BillingSubscription), sub.Id.ToString(), before, sub, ct);
        return NoContent();
    }

    [HttpGet("usage")]
    [Authorize(Policy = CrmPermissions.BillingRead)]
    public async Task<ActionResult<object>> Usage(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var metrics = await db.UsageMetrics.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.RecordedAtUtc)
            .Take(200)
            .Select(x => new { x.MetricKey, x.Value, x.RecordedAtUtc })
            .ToListAsync(ct);
        return Ok(new { items = metrics });
    }
}
