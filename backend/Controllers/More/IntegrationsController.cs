using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("integrations")]
[Authorize]
public class IntegrationsController(ExpogoDbContext db, IAuditTrailService audit, IBillingEntitlementsService billing) : ControllerBase
{
    [HttpGet("webhooks")]
    [Authorize(Policy = CrmPermissions.IntegrationsRead)]
    public async Task<ActionResult<object>> Webhooks(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var hooks = await db.WebhookEndpoints.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new { x.Id, x.Name, x.Url, x.IsActive, x.CreatedAtUtc })
            .ToListAsync(ct);
        return Ok(new { items = hooks });
    }

    public sealed class CreateWebhookRequest
    {
        public string Name { get; set; } = "";
        public string Url { get; set; } = "";
    }

    [HttpPost("webhooks")]
    [Authorize(Policy = CrmPermissions.IntegrationsWrite)]
    public async Task<ActionResult<object>> CreateWebhook([FromBody] CreateWebhookRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Url))
            return BadRequest(new { message = "Заполните имя и URL вебхука." });

        var featureCheck = await billing.EnsureFeatureAsync(tenantId, BillingFeature.Integrations, ct);
        var featureError = this.ToBillingActionResult(featureCheck);
        if (featureError is not null)
            return featureError;

        var hook = new WebhookEndpoint
        {
            TenantId = tenantId,
            Name = req.Name.Trim(),
            Url = req.Url.Trim(),
            Secret = Convert.ToBase64String(Guid.NewGuid().ToByteArray()),
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.WebhookEndpoints.Add(hook);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(tenantId, "integrations.webhook.create", nameof(WebhookEndpoint), hook.Id.ToString(), null, hook, ct);
        return CreatedAtAction(nameof(Webhooks), new { id = hook.Id }, new { hook.Id, hook.Secret });
    }

    public sealed class EnqueueJobRequest
    {
        public string JobType { get; set; } = "webhook";
        public string? PayloadJson { get; set; }
    }

    [HttpPost("jobs")]
    [Authorize(Policy = CrmPermissions.IntegrationsWrite)]
    public async Task<ActionResult<object>> EnqueueJob([FromBody] EnqueueJobRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var featureCheck = await billing.EnsureFeatureAsync(tenantId, BillingFeature.Integrations, ct);
        var featureError = this.ToBillingActionResult(featureCheck);
        if (featureError is not null)
            return featureError;

        var job = new IntegrationJob
        {
            TenantId = tenantId,
            JobType = string.IsNullOrWhiteSpace(req.JobType) ? "webhook" : req.JobType.Trim().ToLowerInvariant(),
            PayloadJson = req.PayloadJson,
            Status = IntegrationJobStatus.Pending,
            ScheduledAtUtc = DateTime.UtcNow,
        };
        db.IntegrationJobs.Add(job);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(tenantId, "integrations.job.enqueue", nameof(IntegrationJob), job.Id.ToString(), null, job, ct);
        return Ok(new { job.Id, status = job.Status.ToString() });
    }

    [HttpGet("jobs")]
    [Authorize(Policy = CrmPermissions.IntegrationsRead)]
    public async Task<ActionResult<object>> Jobs(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var jobs = await db.IntegrationJobs.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.Id)
            .Take(100)
            .Select(x => new { x.Id, x.JobType, status = x.Status.ToString(), x.Attempts, x.ScheduledAtUtc, x.ProcessedAtUtc, x.LastError })
            .ToListAsync(ct);
        return Ok(new { items = jobs });
    }
}
