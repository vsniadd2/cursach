using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("team")]
[Authorize]
public class TeamController(ExpogoDbContext db, IAuditTrailService audit, INotificationService notifications, IBillingEntitlementsService billing) : ControllerBase
{
    private static readonly HashSet<TenantRole> AllowedRoles = [TenantRole.Admin, TenantRole.Member];

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
                x.User.IsBlocked,
                x.User.LockoutEndUtc,
                x.CreatedAtUtc,
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
        if (!AllowedRoles.Contains(req.Role))
            return BadRequest(new { message = "Допустимые роли: Admin и Member." });

        var tenantId = this.RequireTenantId();
        var roleCheck = await billing.EnsureFeatureAsync(tenantId, BillingFeature.RoleManagement, ct);
        var roleError = this.ToBillingActionResult(roleCheck);
        if (roleError is not null)
            return roleError;

        var actorUserId = ParseUserId(User);
        if (actorUserId is not null && actorUserId.Value == req.UserId)
            return BadRequest(new { message = "Нельзя изменить собственную роль." });

        var member = await db.TenantMemberships.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == req.UserId, ct);
        if (member is null) return NotFound(new { message = "Участник не найден" });

        if (member.Role == TenantRole.Admin && req.Role != TenantRole.Admin)
        {
            var adminCount = await db.TenantMemberships.CountAsync(
                x => x.TenantId == tenantId && x.Role == TenantRole.Admin,
                ct);
            if (adminCount <= 1)
                return BadRequest(new { message = "Нельзя снять роль у последнего администратора." });
        }

        var before = member.Role;
        member.Role = req.Role;
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(tenantId, "team.update-role", nameof(TenantMembership), member.Id.ToString(), new { role = before }, new { role = req.Role }, ct);
        await notifications.NotifyUserAsync(
            tenantId,
            req.UserId,
            NotificationTypes.TeamRoleChanged,
            "Изменена роль",
            $"Ваша роль в организации: {TenantRoleLabelRu(req.Role)}",
            nameof(TenantMembership),
            member.Id.ToString(),
            $"team-role:{req.UserId}:{req.Role}",
            ct
        );
        return NoContent();
    }

    public sealed class BlockUserRequest
    {
        public int UserId { get; set; }
        public bool Blocked { get; set; }
    }

    [HttpPatch("block")]
    [Authorize(Policy = CrmPermissions.TeamWrite)]
    public async Task<ActionResult> BlockUser([FromBody] BlockUserRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var roleCheck = await billing.EnsureFeatureAsync(tenantId, BillingFeature.RoleManagement, ct);
        var roleError = this.ToBillingActionResult(roleCheck);
        if (roleError is not null)
            return roleError;

        var actorUserId = ParseUserId(User);
        if (actorUserId is not null && actorUserId.Value == req.UserId)
            return BadRequest(new { message = "Нельзя заблокировать собственный аккаунт." });

        var member = await db.TenantMemberships
            .Include(x => x.User)
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == req.UserId, ct);
        if (member is null) return NotFound(new { message = "Участник не найден" });

        if (req.Blocked && member.Role == TenantRole.Admin)
        {
            var adminCount = await db.TenantMemberships.CountAsync(
                x => x.TenantId == tenantId && x.Role == TenantRole.Admin && !x.User.IsBlocked,
                ct);
            if (adminCount <= 1 && !member.User.IsBlocked)
                return BadRequest(new { message = "Нельзя заблокировать последнего активного администратора." });
        }

        var before = member.User.IsBlocked;
        member.User.IsBlocked = req.Blocked;
        if (req.Blocked)
        {
            member.User.LockoutEndUtc = null;
            member.User.FailedLoginAttempts = 0;
        }

        await db.SaveChangesAsync(ct);
        var action = req.Blocked ? "team.block" : "team.unblock";
        await audit.WriteAsync(tenantId, action, nameof(AppUser), member.UserId.ToString(), new { isBlocked = before }, new { isBlocked = req.Blocked }, ct);
        await notifications.NotifyUserAsync(
            tenantId,
            req.UserId,
            req.Blocked ? NotificationTypes.TeamBlocked : NotificationTypes.TeamRoleChanged,
            req.Blocked ? "Аккаунт заблокирован" : "Аккаунт разблокирован",
            req.Blocked
                ? "Администратор ограничил доступ к Экспого. Обратитесь к администратору."
                : "Доступ к Экспого восстановлен.",
            nameof(AppUser),
            member.UserId.ToString(),
            $"team-block:{req.UserId}:{req.Blocked}",
            ct
        );
        return NoContent();
    }

    private static int? ParseUserId(ClaimsPrincipal user)
    {
        var sub =
            user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(sub, out var id) ? id : null;
    }

    private static string TenantRoleLabelRu(TenantRole role) => role switch
    {
        TenantRole.Admin => "Администратор",
        TenantRole.Member => "Пользователь",
        TenantRole.Owner => "Владелец",
        TenantRole.Viewer => "Наблюдатель",
        _ => role.ToString(),
    };
}
