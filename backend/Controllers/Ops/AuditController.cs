using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.Ops;

[ApiController]
[Route("audit")]
[Authorize]
public class AuditController(ExpogoDbContext db, IPaymentReceiptPdfService receipts) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CrmPermissions.AuditRead)]
    public async Task<ActionResult<object>> List([FromQuery] int take = 100, CancellationToken ct = default)
    {
        var tenantId = this.RequireTenantId();
        take = Math.Clamp(take, 1, 500);
        var items = await (
            from log in db.AuditLogs.AsNoTracking()
            where log.TenantId == tenantId
            join user in db.Users.AsNoTracking() on log.UserId equals user.Id into users
            from user in users.DefaultIfEmpty()
            orderby log.CreatedAtUtc descending
            select new
            {
                log.Id,
                log.Action,
                log.EntityType,
                log.EntityId,
                log.UserId,
                UserName = user != null ? user.FullName ?? user.Username : null,
                log.CorrelationId,
                log.CreatedAtUtc,
                log.BeforeJson,
                log.AfterJson
            }
        ).Take(take).ToListAsync(ct);
        return Ok(new { items });
    }

    [HttpGet("{id:long}/receipt")]
    [Authorize(Policy = CrmPermissions.AuditRead)]
    public async Task<IActionResult> DownloadReceipt(long id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var log = await db.AuditLogs.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id, ct);
        if (log is null)
            return NotFound(new { message = "Запись аудита не найдена." });

        if (!string.Equals(log.Action, "billing.checkout", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Чек доступен только для оплаты подписки (billing.checkout)." });

        var tenant = await db.Tenants.AsNoTracking().SingleAsync(x => x.Id == tenantId, ct);
        AppUser? payer = null;
        if (log.UserId is int userId)
            payer = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct);

        var subscription = await db.BillingSubscriptions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);

        var data = receipts.BuildFromAudit(log, tenant, payer, subscription);
        if (data is null)
            return BadRequest(new { message = "Не удалось сформировать чек по записи аудита." });

        var pdf = receipts.BuildPdf(data);
        var fileName = $"expogo-receipt-{data.ReceiptNumber}.pdf";
        return File(pdf, "application/pdf", fileName);
    }
}
