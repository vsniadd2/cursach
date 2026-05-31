using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("automations")]
[Authorize]
public class AutomationsController(ExpogoDbContext db, IAuditTrailService audit) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CrmPermissions.DealsRead)]
    public async Task<ActionResult<object>> List(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var rules = await db.AutomationRules.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new { x.Id, x.Name, x.Trigger, x.Action, x.ConfigJson, x.IsEnabled, x.CreatedAtUtc })
            .ToListAsync(ct);
        return Ok(new { items = rules });
    }

    public sealed class RuleUpsertRequest
    {
        public string Name { get; set; } = "";
        public string Trigger { get; set; } = "";
        public string Action { get; set; } = "";
        public string? ConfigJson { get; set; }
        public bool IsEnabled { get; set; } = true;
    }

    [HttpPost]
    [Authorize(Policy = CrmPermissions.AutomationsWrite)]
    public async Task<ActionResult<object>> Create([FromBody] RuleUpsertRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Trigger) || string.IsNullOrWhiteSpace(req.Action))
            return BadRequest(new { message = "Name/Trigger/Action обязательны." });

        var rule = new AutomationRule
        {
            TenantId = tenantId,
            Name = req.Name.Trim(),
            Trigger = req.Trigger.Trim().ToLowerInvariant(),
            Action = req.Action.Trim().ToLowerInvariant(),
            ConfigJson = req.ConfigJson,
            IsEnabled = req.IsEnabled,
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.AutomationRules.Add(rule);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(tenantId, "automations.create", nameof(AutomationRule), rule.Id.ToString(), null, rule, ct);
        return CreatedAtAction(nameof(List), new { id = rule.Id }, new { id = rule.Id });
    }
}
