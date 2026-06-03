using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using ExpogoCrm.Api.Services.Integrations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("clients")]
[Authorize]
public class ClientsController : ControllerBase
{
    private readonly ExpogoDbContext _db;
    private readonly IAuditTrailService _audit;
    private readonly IBillingEntitlementsService _billing;
    private readonly IIntegrationDispatchService _integrations;

    public ClientsController(
        ExpogoDbContext db,
        IAuditTrailService audit,
        IBillingEntitlementsService billing,
        IIntegrationDispatchService integrations)
    {
        _db = db;
        _audit = audit;
        _billing = billing;
        _integrations = integrations;
    }

    public record ClientsListResponse(
        int Page,
        int PageSize,
        int Total,
        List<ClientListItem> Items
    );

    public record ClientListItem(
        int Id,
        string FullName,
        string Company,
        string? RoleTitle,
        string? AvatarSmallUrl,
        int AvatarHue,
        DateTime CreatedAtUtc
    );

    public class ClientUpsertRequest
    {
        [Required, MaxLength(128)]
        public string FullName { get; set; } = string.Empty;

        [Required, MaxLength(128)]
        public string Company { get; set; } = string.Empty;

        [MaxLength(128)]
        public string? RoleTitle { get; set; }

        [MaxLength(32)]
        public string? Phone { get; set; }

        [MaxLength(128)]
        public string? WorkEmail { get; set; }

        [MaxLength(512)]
        public string? AvatarLargeUrl { get; set; }

        [MaxLength(512)]
        public string? AvatarSmallUrl { get; set; }
    }

    [HttpGet]
    [Authorize(Policy = CrmPermissions.ClientsRead)]
    public async Task<ActionResult<ClientsListResponse>> List(
        [FromQuery] string? q,
        [FromQuery] string? company,
        [FromQuery] DateTime? createdFrom,
        [FromQuery] DateTime? createdTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sort = null,
        CancellationToken ct = default
    )
    {
        var tenantId = this.RequireTenantId();
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var query = _db.Clients.AsNoTracking().Where(c => c.TenantId == tenantId).AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(c => c.FullName.ToLower().Contains(term) || c.Company.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(company))
        {
            var term = company.Trim().ToLower();
            query = query.Where(c => c.Company.ToLower().Contains(term));
        }

        if (createdFrom is not null)
            query = query.Where(c => c.CreatedAtUtc >= createdFrom.Value.ToUniversalTime());
        if (createdTo is not null)
            query = query.Where(c => c.CreatedAtUtc <= createdTo.Value.ToUniversalTime());

        query = sort?.Trim().ToLower() switch
        {
            "name" => query.OrderBy(c => c.FullName),
            "-name" => query.OrderByDescending(c => c.FullName),
            "company" => query.OrderBy(c => c.Company),
            "-company" => query.OrderByDescending(c => c.Company),
            "created" => query.OrderBy(c => c.CreatedAtUtc),
            "-created" or _ => query.OrderByDescending(c => c.CreatedAtUtc),
        };

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new ClientListItem(
                c.Id,
                c.FullName,
                c.Company,
                c.RoleTitle,
                c.AvatarSmallUrl,
                c.AvatarHue,
                c.CreatedAtUtc
            ))
            .ToListAsync(ct);

        return Ok(new ClientsListResponse(page, pageSize, total, items));
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = CrmPermissions.ClientsRead)]
    public async Task<ActionResult<object>> Get(int id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var client = await _db.Clients.SingleOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, ct);
        if (client is null) return NotFound();

        var activeDeal = await _db.Deals
            .Where(d => d.ClientId == id && d.TenantId == tenantId)
            .OrderByDescending(d => d.Stage == DealStage.Negotiation)
            .ThenByDescending(d => d.CreatedAtUtc)
            .Select(d => new
            {
                d.Id,
                d.Title,
                d.Stage,
                d.Amount,
                d.ProbabilityPct,
                d.ExpectedCloseDateUtc,
                d.DecisionMaker,
            })
            .FirstOrDefaultAsync(ct);

        var events = await _db.ContactEvents
            .Where(e => e.ClientId == id && e.TenantId == tenantId)
            .OrderByDescending(e => e.OccurredAtUtc)
            .Select(e => new
            {
                e.Id,
                e.Title,
                e.Body,
                e.OccurredAtUtc,
            })
            .ToListAsync(ct);

        return Ok(new
        {
            client = new
            {
                client.Id,
                client.FullName,
                client.Company,
                client.RoleTitle,
                client.Phone,
                client.WorkEmail,
                client.AvatarLargeUrl,
                client.AvatarSmallUrl,
                avatarHue = client.AvatarHue != 0 ? client.AvatarHue : ClientAvatarColor.DefaultHue(client.Id),
                client.CreatedAtUtc,
            },
            activeDeal,
            events,
        });
    }

    [HttpPost]
    [Authorize(Policy = CrmPermissions.ClientsWrite)]
    public async Task<ActionResult<object>> Create([FromBody] ClientUpsertRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var limitCheck = await _billing.EnsureCanAddContactAsync(tenantId, ct);
        var limitError = this.ToBillingActionResult(limitCheck);
        if (limitError is not null)
            return limitError;

        var fullName = req.FullName.Trim();
        var company = req.Company.Trim();
        if (fullName.Length == 0) return BadRequest(new { message = "ФИО не может быть пустым" });
        if (company.Length == 0) return BadRequest(new { message = "Компания не может быть пустой" });

        var client = new Client
        {
            TenantId = tenantId,
            FullName = fullName,
            Company = company,
            RoleTitle = string.IsNullOrWhiteSpace(req.RoleTitle) ? null : req.RoleTitle.Trim(),
            Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim(),
            WorkEmail = string.IsNullOrWhiteSpace(req.WorkEmail) ? null : req.WorkEmail.Trim(),
            AvatarLargeUrl = string.IsNullOrWhiteSpace(req.AvatarLargeUrl) ? null : req.AvatarLargeUrl.Trim(),
            AvatarSmallUrl = string.IsNullOrWhiteSpace(req.AvatarSmallUrl) ? null : req.AvatarSmallUrl.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
        };
        _db.Clients.Add(client);
        await _db.SaveChangesAsync(ct);
        client.AvatarHue = ClientAvatarColor.AssignHue(client.Id, client.FullName, client.Company);
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "clients.create", nameof(Client), client.Id.ToString(), null, client, ct);
        _integrations.NotifyNewClient(tenantId, client);

        return CreatedAtAction(nameof(Get), new { id = client.Id }, new { id = client.Id, avatarHue = client.AvatarHue });
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = CrmPermissions.ClientsWrite)]
    public async Task<ActionResult> Update(int id, [FromBody] ClientUpsertRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var client = await _db.Clients.SingleOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, ct);
        if (client is null) return NotFound(new { message = "Клиент не найден" });
        var before = new { client.FullName, client.Company, client.RoleTitle, client.Phone, client.WorkEmail, client.AvatarLargeUrl, client.AvatarSmallUrl };

        var fullName = req.FullName.Trim();
        var company = req.Company.Trim();
        if (fullName.Length == 0) return BadRequest(new { message = "ФИО не может быть пустым" });
        if (company.Length == 0) return BadRequest(new { message = "Компания не может быть пустой" });

        client.FullName = fullName;
        client.Company = company;
        client.RoleTitle = string.IsNullOrWhiteSpace(req.RoleTitle) ? null : req.RoleTitle.Trim();
        client.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim();
        client.WorkEmail = string.IsNullOrWhiteSpace(req.WorkEmail) ? null : req.WorkEmail.Trim();
        client.AvatarLargeUrl = string.IsNullOrWhiteSpace(req.AvatarLargeUrl) ? null : req.AvatarLargeUrl.Trim();
        client.AvatarSmallUrl = string.IsNullOrWhiteSpace(req.AvatarSmallUrl) ? null : req.AvatarSmallUrl.Trim();

        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "clients.update", nameof(Client), client.Id.ToString(), before, client, ct);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = CrmPermissions.ClientsWrite)]
    public async Task<ActionResult> Delete(int id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var client = await _db.Clients.SingleOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, ct);
        if (client is null) return NotFound(new { message = "Клиент не найден" });
        var before = new { client.Id, client.FullName, client.Company };
        _db.Clients.Remove(client);
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "clients.delete", nameof(Client), id.ToString(), before, null, ct);
        return NoContent();
    }
}

