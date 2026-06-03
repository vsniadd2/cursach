using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly ExpogoDbContext _db;

    public DashboardController(ExpogoDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [Authorize(Policy = CrmPermissions.DashboardRead)]
    public async Task<ActionResult<object>> Get([FromQuery] int? activitiesTake, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var prevMonthStart = monthStart.AddMonths(-1);
        var monthSales = await _db.Deals
            .Where(d => d.TenantId == tenantId && d.Stage == DealStage.Closed && d.CreatedAtUtc >= monthStart)
            .SumAsync(d => (decimal?)d.Amount, ct) ?? 0m;
        var prevMonthSales = await _db.Deals
            .Where(d => d.TenantId == tenantId && d.Stage == DealStage.Closed
                && d.CreatedAtUtc >= prevMonthStart && d.CreatedAtUtc < monthStart)
            .SumAsync(d => (decimal?)d.Amount, ct) ?? 0m;

        decimal? monthSalesGrowthPct = prevMonthSales == 0m
            ? monthSales == 0m ? null : 100m
            : Math.Round((monthSales - prevMonthSales) / prevMonthSales * 100m, 1);

        var actTake = activitiesTake is null or < 1 or > 200 ? 10 : activitiesTake.Value;

        var newLeads = await _db.Deals.CountAsync(d => d.TenantId == tenantId && d.Stage == DealStage.Lead, ct);
        var activeTasks = await _db.Tasks.CountAsync(t => t.TenantId == tenantId && !t.Done, ct);

        var stageAgg = await _db.Deals
            .Where(d => d.TenantId == tenantId)
            .GroupBy(d => d.Stage)
            .Select(g => new
            {
                stage = g.Key,
                count = g.Count(),
                sum = g.Sum(x => x.Amount),
            })
            .ToListAsync(ct);

        var countByStage = stageAgg.ToDictionary(x => x.stage.ToString(), x => x.count);
        var sumByStage = stageAgg.ToDictionary(x => x.stage.ToString(), x => x.sum);

        // Упрощённая "просрочка": задачи на даты раньше сегодняшней и не выполнены
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var overdueTasks = await _db.Tasks.CountAsync(t => t.TenantId == tenantId && !t.Done && t.Date < today, ct);

        var activities = await _db.ActivityEvents
            .Where(a => a.TenantId == tenantId)
            .OrderByDescending(a => a.CreatedAtUtc)
            .Take(actTake)
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.Description,
                a.AvatarUrl,
                a.BadgeIcon,
                a.CreatedAtUtc,
            })
            .ToListAsync(ct);

        return Ok(new
        {
            monthSales,
            monthSalesGrowthPct,
            newLeads,
            activeTasks,
            overdueTasks,
            dealsByStage = new { countByStage, sumByStage },
            activities,
        });
    }
}

