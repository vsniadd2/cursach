using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("reports")]
[Authorize]
public class ReportsController(ExpogoDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    [Authorize(Policy = CrmPermissions.ReportsRead)]
    public async Task<ActionResult<object>> Summary(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var quarterStart = monthStart.AddMonths(-2);

        var totalDeals = await db.Deals.CountAsync(x => x.TenantId == tenantId, ct);
        var closedDeals = await db.Deals.CountAsync(x => x.TenantId == tenantId && x.Stage == DealStage.Closed, ct);
        var monthRevenueUsd = await db.Deals.Where(x => x.TenantId == tenantId && x.Stage == DealStage.Closed && x.CreatedAtUtc >= monthStart).SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var quarterRevenueUsd = await db.Deals.Where(x => x.TenantId == tenantId && x.Stage == DealStage.Closed && x.CreatedAtUtc >= quarterStart).SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var conversion = totalDeals == 0 ? 0 : Math.Round((decimal)closedDeals / totalDeals * 100m, 2);
        var overdueTasks = await db.Tasks.CountAsync(x => x.TenantId == tenantId && !x.Done && x.Date < DateOnly.FromDateTime(now), ct);

        return Ok(new
        {
            totalDeals,
            closedDeals,
            conversionPct = conversion,
            monthRevenueUsd,
            quarterRevenueUsd,
            overdueTasks
        });
    }
}
