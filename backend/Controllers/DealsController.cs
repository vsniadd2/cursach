using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("deals")]
[Authorize]
public class DealsController : ControllerBase
{
    private readonly ExpogoDbContext _db;
    private readonly IAuditTrailService _audit;
    private readonly INotificationService _notifications;
    private readonly ICurrentTenantAccessor _current;

    public DealsController(
        ExpogoDbContext db,
        IAuditTrailService audit,
        INotificationService notifications,
        ICurrentTenantAccessor current
    )
    {
        _db = db;
        _audit = audit;
        _notifications = notifications;
        _current = current;
    }

    public record DealListItem(
        int Id,
        int ClientId,
        string ClientName,
        string ClientCompany,
        string Title,
        DealStage Stage,
        decimal Amount,
        int ProbabilityPct,
        DateTime? ExpectedCloseDateUtc,
        DateTime CreatedAtUtc
    );

    public record DealsListResponse(int Page, int PageSize, int Total, List<DealListItem> Items);

    public class DealUpsertRequest
    {
        [Required]
        public int ClientId { get; set; }

        [Required, MaxLength(160)]
        public string Title { get; set; } = string.Empty;

        public DealStage Stage { get; set; }

        [Range(0, double.MaxValue)]
        public decimal Amount { get; set; }

        [Range(0, 100)]
        public int ProbabilityPct { get; set; }

        public DateTime? ExpectedCloseDateUtc { get; set; }

        [MaxLength(128)]
        public string? DecisionMaker { get; set; }
    }

    public record DealStageRequest(DealStage Stage);
    public record BulkStageRequest(List<int> DealIds, DealStage Stage);

    [HttpGet]
    [Authorize(Policy = CrmPermissions.DealsRead)]
    public async Task<ActionResult<DealsListResponse>> List(
        [FromQuery] string? q,
        [FromQuery] DealStage? stage,
        [FromQuery] int? clientId,
        [FromQuery] decimal? amountMin,
        [FromQuery] decimal? amountMax,
        [FromQuery] DateTime? expectedCloseFrom,
        [FromQuery] DateTime? expectedCloseTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sort = null,
        CancellationToken ct = default
    )
    {
        var tenantId = this.RequireTenantId();
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var query = _db.Deals.AsNoTracking()
            .Include(d => d.Client)
            .Where(d => d.TenantId == tenantId)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(d =>
                d.Title.ToLower().Contains(term) ||
                d.Client.FullName.ToLower().Contains(term) ||
                d.Client.Company.ToLower().Contains(term));
        }

        if (stage is not null) query = query.Where(d => d.Stage == stage.Value);
        if (clientId is not null) query = query.Where(d => d.ClientId == clientId.Value);
        if (amountMin is not null) query = query.Where(d => d.Amount >= amountMin.Value);
        if (amountMax is not null) query = query.Where(d => d.Amount <= amountMax.Value);

        if (expectedCloseFrom is not null)
            query = query.Where(d => d.ExpectedCloseDateUtc != null && d.ExpectedCloseDateUtc >= expectedCloseFrom.Value.ToUniversalTime());
        if (expectedCloseTo is not null)
            query = query.Where(d => d.ExpectedCloseDateUtc != null && d.ExpectedCloseDateUtc <= expectedCloseTo.Value.ToUniversalTime());

        query = sort?.Trim().ToLower() switch
        {
            "amount" => query.OrderBy(d => d.Amount),
            "-amount" => query.OrderByDescending(d => d.Amount),
            "created" => query.OrderBy(d => d.CreatedAtUtc),
            "-created" or _ => query.OrderByDescending(d => d.CreatedAtUtc),
        };

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new DealListItem(
                d.Id,
                d.ClientId,
                d.Client.FullName,
                d.Client.Company,
                d.Title,
                d.Stage,
                d.Amount,
                d.ProbabilityPct,
                d.ExpectedCloseDateUtc,
                d.CreatedAtUtc
            ))
            .ToListAsync(ct);

        return Ok(new DealsListResponse(page, pageSize, total, items));
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = CrmPermissions.DealsRead)]
    public async Task<ActionResult<object>> Get(int id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var deal = await _db.Deals.AsNoTracking()
            .Include(d => d.Client)
            .SingleOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, ct);
        if (deal is null) return NotFound(new { message = "Сделка не найдена" });

        return Ok(new
        {
            deal.Id,
            deal.ClientId,
            client = new { deal.Client.FullName, deal.Client.Company },
            deal.Title,
            deal.Stage,
            deal.Amount,
            deal.ProbabilityPct,
            deal.ExpectedCloseDateUtc,
            deal.DecisionMaker,
            deal.CreatedAtUtc,
        });
    }

    [HttpPost]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public async Task<ActionResult<object>> Create([FromBody] DealUpsertRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var clientExists = await _db.Clients.AnyAsync(c => c.Id == req.ClientId && c.TenantId == tenantId, ct);
        if (!clientExists) return BadRequest(new { message = "Клиент не найден" });

        var title = req.Title.Trim();
        if (title.Length == 0) return BadRequest(new { message = "Название не может быть пустым" });

        var deal = new Deal
        {
            TenantId = tenantId,
            ClientId = req.ClientId,
            Title = title,
            Stage = req.Stage,
            Amount = req.Amount,
            ProbabilityPct = req.ProbabilityPct,
            ExpectedCloseDateUtc = req.ExpectedCloseDateUtc?.ToUniversalTime(),
            DecisionMaker = string.IsNullOrWhiteSpace(req.DecisionMaker) ? null : req.DecisionMaker.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
        };

        _db.Deals.Add(deal);
        if (deal.Stage == DealStage.Closed)
            RecordClosedDealMeter(tenantId, deal.Amount);

        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "deals.create", nameof(Deal), deal.Id.ToString(), null, deal, ct);

        return CreatedAtAction(nameof(Get), new { id = deal.Id }, new { id = deal.Id });
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public async Task<ActionResult> Update(int id, [FromBody] DealUpsertRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var deal = await _db.Deals.SingleOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, ct);
        if (deal is null) return NotFound(new { message = "Сделка не найдена" });

        var clientExists = await _db.Clients.AnyAsync(c => c.Id == req.ClientId && c.TenantId == tenantId, ct);
        if (!clientExists) return BadRequest(new { message = "Клиент не найден" });
        var before = new { deal.ClientId, deal.Title, deal.Stage, deal.Amount, deal.ProbabilityPct };

        var title = req.Title.Trim();
        if (title.Length == 0) return BadRequest(new { message = "Название не может быть пустым" });

        var prevStage = deal.Stage;

        deal.ClientId = req.ClientId;
        deal.Title = title;
        deal.Stage = req.Stage;
        deal.Amount = req.Amount;
        deal.ProbabilityPct = req.ProbabilityPct;
        deal.ExpectedCloseDateUtc = req.ExpectedCloseDateUtc?.ToUniversalTime();
        deal.DecisionMaker = string.IsNullOrWhiteSpace(req.DecisionMaker) ? null : req.DecisionMaker.Trim();

        RecordClosedDealMeterIfNeeded(tenantId, prevStage, deal.Stage, deal.Amount);

        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "deals.update", nameof(Deal), deal.Id.ToString(), before, deal, ct);
        return NoContent();
    }

    [HttpPatch("{id:int}/stage")]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public async Task<ActionResult> SetStage(int id, [FromBody] DealStageRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var deal = await _db.Deals.SingleOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, ct);
        if (deal is null) return NotFound(new { message = "Сделка не найдена" });
        var before = deal.Stage;
        if (!IsTransitionAllowed(deal.Stage, req.Stage))
            return BadRequest(new { message = "Недопустимый переход стадии." });
        deal.Stage = req.Stage;
        RecordClosedDealMeterIfNeeded(tenantId, before, req.Stage, deal.Amount);
        _db.ActivityEvents.Add(new ActivityEvent
        {
            TenantId = tenantId,
            Title = "Сделка",
            Description = $"Смена стадии: {deal.Title} -> {req.Stage}",
            BadgeIcon = "sync",
            CreatedAtUtc = DateTime.UtcNow,
        });

        if (req.Stage == DealStage.Negotiation)
        {
            _db.Tasks.Add(new TaskItem
            {
                TenantId = tenantId,
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                Title = $"Follow-up по сделке: {deal.Title}",
                Description = "Автозадача по правилу стадии Negotiation",
                Priority = TaskPriority.Medium,
                Done = false,
                CreatedAtUtc = DateTime.UtcNow,
            });
        }
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "deals.stage", nameof(Deal), deal.Id.ToString(), new { Stage = before }, new { Stage = req.Stage }, ct);
        await _notifications.NotifyTenantExceptAsync(
            tenantId,
            _current.UserId,
            NotificationTypes.DealStageChanged,
            "Смена стадии сделки",
            $"«{deal.Title}» → {DealStageLabelRu(req.Stage)}",
            nameof(Deal),
            deal.Id.ToString(),
            $"deal-stage:{deal.Id}:{req.Stage}",
            ct
        );
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public async Task<ActionResult> Delete(int id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var deal = await _db.Deals.SingleOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, ct);
        if (deal is null) return NotFound(new { message = "Сделка не найдена" });
        var before = new { deal.Id, deal.Title, deal.Stage, deal.Amount };
        _db.Deals.Remove(deal);
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "deals.delete", nameof(Deal), id.ToString(), before, null, ct);
        return NoContent();
    }

    [HttpPatch("bulk/stage")]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public async Task<ActionResult<object>> BulkStage([FromBody] BulkStageRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (req.DealIds.Count == 0) return Ok(new { updated = 0 });
        var deals = await _db.Deals.Where(x => x.TenantId == tenantId && req.DealIds.Contains(x.Id)).ToListAsync(ct);
        var updated = 0;
        foreach (var deal in deals)
        {
            if (!IsTransitionAllowed(deal.Stage, req.Stage))
                continue;
            var prev = deal.Stage;
            deal.Stage = req.Stage;
            RecordClosedDealMeterIfNeeded(tenantId, prev, req.Stage, deal.Amount);
            updated++;
        }
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "deals.bulk-stage", nameof(Deal), "bulk", null, new { ids = req.DealIds, req.Stage }, ct);
        return Ok(new { updated });
    }

    [HttpGet("pipeline")]
    [Authorize(Policy = CrmPermissions.DealsRead)]
    public async Task<ActionResult<object>> Pipeline(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var deals = await _db.Deals
            .Include(d => d.Client)
            .Where(d => d.TenantId == tenantId)
            .OrderBy(d => d.Stage)
            .ThenByDescending(d => d.Amount)
            .Select(d => new
            {
                d.Id,
                d.Title,
                d.Stage,
                d.Amount,
                d.ProbabilityPct,
                client = new
                {
                    d.ClientId,
                    d.Client.FullName,
                    d.Client.Company,
                    d.Client.AvatarSmallUrl,
                }
            })
            .ToListAsync(ct);

        var grouped = deals
            .GroupBy(x => x.Stage)
            .ToDictionary(g => g.Key.ToString(), g => g.ToList());

        var total = deals.Sum(x => x.Amount);
        var weighted = deals.Sum(x => x.Amount * (x.ProbabilityPct / 100m));
        var avg = deals.Count == 0 ? 0m : deals.Average(x => x.Amount);

        return Ok(new
        {
            totals = new { total, weighted, avg },
            stages = grouped
        });
    }

    private void RecordClosedDealMeter(int tenantId, decimal amountUsd)
    {
        var now = DateTime.UtcNow;
        _db.UsageMetrics.Add(new UsageMetric
        {
            TenantId = tenantId,
            MetricKey = "deals.closed.count",
            Value = 1,
            RecordedAtUtc = now,
        });
        _db.UsageMetrics.Add(new UsageMetric
        {
            TenantId = tenantId,
            MetricKey = "deals.closed.revenue_usd",
            Value = amountUsd,
            RecordedAtUtc = now,
        });
    }

    private void RecordClosedDealMeterIfNeeded(int tenantId, DealStage previous, DealStage next, decimal amountUsd)
    {
        if (next != DealStage.Closed || previous == DealStage.Closed)
            return;
        RecordClosedDealMeter(tenantId, amountUsd);
    }

    private static bool IsTransitionAllowed(DealStage from, DealStage to)
    {
        if (from == to) return true;
        return from switch
        {
            DealStage.Lead => to is DealStage.Negotiation or DealStage.Closed,
            DealStage.Negotiation => to is DealStage.Closed or DealStage.Lead,
            DealStage.Closed => to is DealStage.Negotiation,
            _ => false
        };
    }

    private static string DealStageLabelRu(DealStage stage) => stage switch
    {
        DealStage.Lead => "Лид",
        DealStage.Negotiation => "Переговоры",
        DealStage.Closed => "Закрыто",
        _ => stage.ToString(),
    };
}

