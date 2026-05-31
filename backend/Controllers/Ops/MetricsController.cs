using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.Ops;

[ApiController]
[Route("ops")]
[Authorize]
public class MetricsController(ExpogoDbContext db) : ControllerBase
{
    [HttpGet("metrics")]
    [Authorize(Policy = CrmPermissions.Admin)]
    public async Task<ActionResult<object>> Metrics(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var now = DateTime.UtcNow;
        var minuteAgo = now.AddMinutes(-1);
        var hourAgo = now.AddHours(-1);

        var metrics = new
        {
            tenantId,
            users = await db.TenantMemberships.CountAsync(x => x.TenantId == tenantId, ct),
            clients = await db.Clients.CountAsync(x => x.TenantId == tenantId, ct),
            deals = await db.Deals.CountAsync(x => x.TenantId == tenantId, ct),
            tasks = await db.Tasks.CountAsync(x => x.TenantId == tenantId, ct),
            auditLastMinute = await db.AuditLogs.CountAsync(x => x.TenantId == tenantId && x.CreatedAtUtc >= minuteAgo, ct),
            jobsPending = await db.IntegrationJobs.CountAsync(x => x.TenantId == tenantId && x.Status == IntegrationJobStatus.Pending, ct),
            jobsFailedLastHour = await db.IntegrationJobs.CountAsync(x => x.TenantId == tenantId && x.Status == IntegrationJobStatus.Failed && x.ScheduledAtUtc >= hourAgo, ct)
        };
        return Ok(metrics);
    }
}
