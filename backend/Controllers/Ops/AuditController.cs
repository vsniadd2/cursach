using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.Ops;

[ApiController]
[Route("audit")]
[Authorize]
public class AuditController(ExpogoDbContext db) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CrmPermissions.AuditRead)]
    public async Task<ActionResult<object>> List([FromQuery] int take = 100, CancellationToken ct = default)
    {
        var tenantId = this.RequireTenantId();
        take = Math.Clamp(take, 1, 500);
        var items = await db.AuditLogs.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(take)
            .Select(x => new
            {
                x.Id,
                x.Action,
                x.EntityType,
                x.EntityId,
                x.UserId,
                x.CorrelationId,
                x.CreatedAtUtc,
                x.BeforeJson,
                x.AfterJson
            })
            .ToListAsync(ct);
        return Ok(new { items });
    }
}
