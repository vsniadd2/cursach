using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("team")]
[Authorize]
public class TeamController(ExpogoDbContext db, IAuditTrailService audit) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CrmPermissions.TeamRead)]
    public async Task<ActionResult<object>> List(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var members = await db.TenantMemberships.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Include(x => x.User)
            .OrderBy(x => x.Role)
            .ThenBy(x => x.User.Username)
            .Select(x => new
            {
                x.Id,
                x.UserId,
                x.User.Username,
                x.User.FullName,
                x.User.Email,
                role = x.Role.ToString(),
                x.CreatedAtUtc
            })
            .ToListAsync(ct);
        return Ok(new { items = members });
    }

    public sealed class UpdateRoleRequest
    {
        public int UserId { get; set; }
        public TenantRole Role { get; set; }
    }

    [HttpPatch("role")]
    [Authorize(Policy = CrmPermissions.TeamWrite)]
    public async Task<ActionResult> UpdateRole([FromBody] UpdateRoleRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var member = await db.TenantMemberships.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == req.UserId, ct);
        if (member is null) return NotFound(new { message = "Участник не найден" });
        var before = member.Role;
        member.Role = req.Role;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(tenantId, "team.update-role", nameof(TenantMembership), member.Id.ToString(), new { role = before }, new { role = req.Role }, ct);
        return NoContent();
    }
}
