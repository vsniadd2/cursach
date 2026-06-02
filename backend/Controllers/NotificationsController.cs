using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("notifications")]
[Authorize]
public class NotificationsController(ExpogoDbContext db, INotificationService notifications) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CrmPermissions.DashboardRead)]
    public async Task<ActionResult<object>> List(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int take = 50,
        CancellationToken ct = default
    )
    {
        var tenantId = this.RequireTenantId();
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        take = Math.Clamp(take, 1, 100);
        await notifications.SyncRemindersAsync(tenantId, userId.Value, ct);

        var query = db.UserNotifications.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.UserId == userId.Value);

        if (unreadOnly) query = query.Where(x => !x.IsRead);

        var items = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(take)
            .Select(x => new
            {
                x.Id,
                x.Type,
                x.Title,
                x.Body,
                x.EntityType,
                x.EntityId,
                x.IsRead,
                x.CreatedAtUtc,
            })
            .ToListAsync(ct);

        var unreadCount = await db.UserNotifications.CountAsync(
            x => x.TenantId == tenantId && x.UserId == userId.Value && !x.IsRead,
            ct
        );

        return Ok(new { unreadCount, items });
    }

    [HttpGet("unread-count")]
    [Authorize(Policy = CrmPermissions.DashboardRead)]
    public async Task<ActionResult<object>> UnreadCount(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        await notifications.SyncRemindersAsync(tenantId, userId.Value, ct);

        var count = await db.UserNotifications.CountAsync(
            x => x.TenantId == tenantId && x.UserId == userId.Value && !x.IsRead,
            ct
        );
        return Ok(new { unreadCount = count });
    }

    [HttpPatch("{id:long}/read")]
    [Authorize(Policy = CrmPermissions.DashboardRead)]
    public async Task<ActionResult> MarkRead(long id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var item = await db.UserNotifications.SingleOrDefaultAsync(
            x => x.Id == id && x.TenantId == tenantId && x.UserId == userId.Value,
            ct
        );
        if (item is null) return NotFound(new { message = "Уведомление не найдено" });

        item.IsRead = true;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("read-all")]
    [Authorize(Policy = CrmPermissions.DashboardRead)]
    public async Task<ActionResult<object>> MarkAllRead(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var unread = await db.UserNotifications
            .Where(x => x.TenantId == tenantId && x.UserId == userId.Value && !x.IsRead)
            .ToListAsync(ct);

        foreach (var item in unread) item.IsRead = true;
        await db.SaveChangesAsync(ct);
        return Ok(new { updated = unread.Count });
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = CrmPermissions.DashboardRead)]
    public async Task<ActionResult> Delete(long id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var item = await db.UserNotifications.SingleOrDefaultAsync(
            x => x.Id == id && x.TenantId == tenantId && x.UserId == userId.Value,
            ct
        );
        if (item is null) return NotFound(new { message = "Уведомление не найдено" });

        db.UserNotifications.Remove(item);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private int? RequireUserId()
    {
        var sub =
            User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(sub, out var id) ? id : null;
    }
}
