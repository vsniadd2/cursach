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
public class BillingController(
    ExpogoDbContext db,
    IAuditTrailService audit,
    IBillingEntitlementsService billing) : ControllerBase
{
    [HttpGet("plans")]
    [Authorize(Policy = CrmPermissions.BillingRead)]
    public ActionResult<object> Plans()
    {
        var items = BillingPlans.All.Select(p => new
        {
            p.Code,
            p.Name,
            p.PriceUsdPerSeatMonthly,
            p.SeatsLimit,
            p.StorageGbLimit,
            p.ContactsLimit,
            p.FunnelsLimit,
            p.MinSeats,
            p.Integrations,
            p.OpenApi,
            p.AutoTasks,
            p.AdvancedAnalytics,
            p.VipSupport,
            p.RoleManagement,
        });
        return Ok(new { items });
    }

    [HttpGet("subscription")]
    [Authorize(Policy = CrmPermissions.BillingRead)]
    public async Task<ActionResult<object>> Subscription(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var sub = await db.BillingSubscriptions.AsNoTracking().SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (sub is null) return NotFound(new { message = "Подписка не найдена" });

        var plan = await billing.GetPlanAsync(tenantId, ct);
        var usage = await billing.GetUsageAsync(tenantId, ct);

        return Ok(new
        {
            sub.Id,
            sub.TenantId,
            planCode = plan.Code,
            planName = plan.Name,
            sub.Status,
            sub.SeatsLimit,
            sub.StorageGbLimit,
            sub.CurrentPeriodStartUtc,
            sub.CurrentPeriodEndUtc,
            limits = new
            {
                plan.ContactsLimit,
                plan.FunnelsLimit,
                plan.SeatsLimit,
                plan.StorageGbLimit,
                plan.MinSeats,
            },
            usage = new
            {
                contacts = usage.Contacts,
                activeSeats = usage.ActiveSeats,
                pipelines = usage.Pipelines,
                storageGb = usage.StorageGb,
            },
            features = new
            {
                plan.Integrations,
                plan.OpenApi,
                plan.AutoTasks,
                plan.AdvancedAnalytics,
                plan.VipSupport,
                plan.RoleManagement,
            },
        });
    }

    public sealed class UpdateSubscriptionRequest
    {
        public string PlanCode { get; set; } = "free";
    }

    [HttpPatch("subscription")]
    [Authorize(Policy = CrmPermissions.BillingWrite)]
    public async Task<ActionResult> UpdateSubscription([FromBody] UpdateSubscriptionRequest req, CancellationToken ct)
    {
        var plan = BillingPlans.Find(req.PlanCode);
        if (plan is null)
            return BadRequest(new { message = "Допустимые тарифы: free, pro, team." });

        if (plan.Code != "free")
            return BadRequest(new { message = "Для тарифов PRO и TEAM используйте оплату через checkout." });

        var tenantId = this.RequireTenantId();
        var checkoutCheck = await billing.EnsureCanCheckoutAsync(tenantId, plan, ct);
        var checkoutError = this.ToBillingActionResult(checkoutCheck);
        if (checkoutError is not null)
            return checkoutError;

        var sub = await db.BillingSubscriptions.SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (sub is null) return NotFound(new { message = "Подписка не найдена" });

        await ApplyPlanAsync(tenantId, sub, plan, ct);
        await audit.WriteAsync(tenantId, "billing.subscription.update", nameof(BillingSubscription), sub.Id.ToString(), null, sub, ct);
        return NoContent();
    }

    public sealed class CheckoutRequest
    {
        public string PlanCode { get; set; } = "";
        public string CardHolder { get; set; } = "";
        public string CardNumber { get; set; } = "";
        public string Expiry { get; set; } = "";
        public string Cvv { get; set; } = "";
    }

    [HttpPost("checkout")]
    [Authorize(Policy = CrmPermissions.BillingWrite)]
    public async Task<ActionResult<object>> Checkout([FromBody] CheckoutRequest req, CancellationToken ct)
    {
        var plan = BillingPlans.Find(req.PlanCode);
        if (plan is null || plan.Code is "free")
            return BadRequest(new { message = "Checkout доступен только для тарифов pro и team." });

        if (string.IsNullOrWhiteSpace(req.CardHolder)
            || string.IsNullOrWhiteSpace(req.CardNumber)
            || string.IsNullOrWhiteSpace(req.Expiry)
            || string.IsNullOrWhiteSpace(req.Cvv))
            return BadRequest(new { message = "Заполните все платёжные реквизиты." });

        var digits = new string(req.CardNumber.Where(char.IsDigit).ToArray());
        if (digits.Length < 13)
            return BadRequest(new { message = "Некорректный номер карты." });

        var tenantId = this.RequireTenantId();
        var checkoutCheck = await billing.EnsureCanCheckoutAsync(tenantId, plan, ct);
        var checkoutError = this.ToBillingActionResult(checkoutCheck);
        if (checkoutError is not null)
            return checkoutError;

        var sub = await db.BillingSubscriptions.SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (sub is null) return NotFound(new { message = "Подписка не найдена" });

        var before = new { sub.PlanCode, sub.Status };
        await ApplyPlanAsync(tenantId, sub, plan, ct);
        var paidAt = DateTime.UtcNow;
        var receiptNumber = $"RCP-{tenantId}-{paidAt:yyyyMMddHHmmss}";
        var transactionId = $"TXN-{tenantId}-{paidAt:yyyyMMddHHmmssfff}";
        await audit.WriteAsync(
            tenantId,
            "billing.checkout",
            nameof(BillingSubscription),
            sub.Id.ToString(),
            before,
            new
            {
                sub.PlanCode,
                planName = plan.Name,
                sub.Status,
                cardLast4 = digits[^4..],
                amountUsd = plan.PriceUsdPerSeatMonthly,
                receiptNumber,
                transactionId,
                periodStartUtc = sub.CurrentPeriodStartUtc,
                periodEndUtc = sub.CurrentPeriodEndUtc,
                tenantId,
                subscriptionId = sub.Id,
            },
            ct);

        var usage = await billing.GetUsageAsync(tenantId, ct);
        return Ok(new
        {
            planCode = plan.Code,
            planName = plan.Name,
            status = sub.Status,
            sub.CurrentPeriodStartUtc,
            sub.CurrentPeriodEndUtc,
            usage = new
            {
                contacts = usage.Contacts,
                activeSeats = usage.ActiveSeats,
                pipelines = usage.Pipelines,
                storageGb = usage.StorageGb,
            },
        });
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

    private async Task ApplyPlanAsync(int tenantId, BillingSubscription sub, BillingPlanDefinition plan, CancellationToken ct)
    {
        sub.PlanCode = plan.Code;
        sub.SeatsLimit = plan.SeatsLimit;
        sub.StorageGbLimit = plan.StorageGbLimit;
        sub.Status = "active";
        sub.CurrentPeriodStartUtc = DateTime.UtcNow;
        sub.CurrentPeriodEndUtc = plan.Code == "free"
            ? DateTime.UtcNow.AddYears(100)
            : DateTime.UtcNow.AddMonths(1);

        var tenant = await db.Tenants.SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        if (tenant is not null)
            tenant.PlanCode = plan.Code;

        await db.SaveChangesAsync(ct);
    }
}
