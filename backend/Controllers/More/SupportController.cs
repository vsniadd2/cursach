using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("support")]
[Authorize]
public class SupportController(ExpogoDbContext db, ICurrentTenantAccessor current, IAuditTrailService audit, IBillingEntitlementsService billing) : ControllerBase
{
    [HttpGet("faq")]
    [Authorize(Policy = CrmPermissions.SupportRead)]
    public async Task<ActionResult<object>> GetFaq(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var items = await db.SupportFaqItems.AsNoTracking()
            .Where(x => x.TenantId == null || x.TenantId == tenantId)
            .OrderBy(x => x.SortOrder)
            .Select(x => new { id = x.Id.ToString(), x.Question, x.Answer })
            .ToListAsync(ct);
        return Ok(new { items });
    }

    public sealed class TicketRequest
    {
        public string Subject { get; set; } = "";
        public string Body { get; set; } = "";
    }

    [HttpGet("tickets")]
    [Authorize(Policy = CrmPermissions.SupportRead)]
    public async Task<ActionResult<object>> Tickets(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var tickets = await db.SupportTickets.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new { x.Id, x.Subject, x.Status, x.CreatedAtUtc, x.UserId })
            .ToListAsync(ct);
        return Ok(new { items = tickets });
    }

    [HttpPost("tickets")]
    [Authorize(Policy = CrmPermissions.SupportWrite)]
    public async Task<ActionResult<object>> CreateTicket([FromBody] TicketRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var userId = current.UserId;
        if (userId is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(req.Subject) || string.IsNullOrWhiteSpace(req.Body))
            return BadRequest(new { message = "Заполните тему и описание обращения." });

        var plan = await billing.GetPlanAsync(tenantId, ct);

        var ticket = new SupportTicket
        {
            TenantId = tenantId,
            UserId = userId.Value,
            Subject = req.Subject.Trim(),
            Body = req.Body.Trim(),
            Status = "open",
            IsVip = plan.VipSupport,
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.SupportTickets.Add(ticket);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(tenantId, "support.ticket.create", nameof(SupportTicket), ticket.Id.ToString(), null, ticket, ct);
        return CreatedAtAction(nameof(Tickets), new { id = ticket.Id }, new { id = ticket.Id });
    }
}
