using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("pipelines")]
[Authorize]
public class PipelinesController(
    ExpogoDbContext db,
    IAuditTrailService audit,
    IBillingEntitlementsService billing) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CrmPermissions.DealsRead)]
    public async Task<ActionResult<object>> List(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var items = await db.SalesPipelines.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.IsDefault, x.CreatedAtUtc })
            .ToListAsync(ct);
        return Ok(new { items });
    }

    public sealed class CreatePipelineRequest
    {
        public string Name { get; set; } = "";
    }

    [HttpPost]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public async Task<ActionResult<object>> Create([FromBody] CreatePipelineRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Укажите название воронки." });

        var limitCheck = await billing.EnsureCanAddPipelineAsync(tenantId, ct);
        var limitError = this.ToBillingActionResult(limitCheck);
        if (limitError is not null)
            return limitError;

        var pipeline = new SalesPipeline
        {
            TenantId = tenantId,
            Name = req.Name.Trim(),
            IsDefault = false,
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.SalesPipelines.Add(pipeline);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(tenantId, "pipelines.create", nameof(SalesPipeline), pipeline.Id.ToString(), null, pipeline, ct);
        return CreatedAtAction(nameof(List), new { id = pipeline.Id }, new { pipeline.Id, pipeline.Name, pipeline.IsDefault });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public async Task<ActionResult> Delete(int id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var pipeline = await db.SalesPipelines.SingleOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (pipeline is null) return NotFound(new { message = "Воронка не найдена" });
        if (pipeline.IsDefault)
            return BadRequest(new { message = "Нельзя удалить основную воронку." });

        var hasDeals = await db.Deals.AnyAsync(x => x.PipelineId == id && x.TenantId == tenantId, ct);
        if (hasDeals)
            return BadRequest(new { message = "Нельзя удалить воронку с привязанными сделками." });

        db.SalesPipelines.Remove(pipeline);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(tenantId, "pipelines.delete", nameof(SalesPipeline), pipeline.Id.ToString(), pipeline, null, ct);
        return NoContent();
    }
}
