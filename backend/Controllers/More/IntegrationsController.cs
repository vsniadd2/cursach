using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using ExpogoCrm.Api.Services.Integrations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("integrations")]
public class IntegrationsController(
    ExpogoDbContext db,
    IAuditTrailService audit,
    IBillingEntitlementsService billing,
    ITenantIntegrationService integrations,
    IIntegrationTestService integrationTest,
    IGoogleCalendarIntegrationService googleCalendar,
    ICurrentTenantAccessor current) : ControllerBase
{
    [HttpGet("providers")]
    [Authorize(Policy = CrmPermissions.IntegrationsRead)]
    public async Task<ActionResult<object>> ListProviders(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var billingError = await CheckBillingAsync(tenantId, ct);
        if (billingError is not null) return billingError;

        var items = await integrations.ListProvidersAsync(tenantId, ct);
        return Ok(new { items });
    }

    [HttpGet("providers/{provider}")]
    [Authorize(Policy = CrmPermissions.IntegrationsRead)]
    public async Task<ActionResult<object>> GetProvider(string provider, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var billingError = await CheckBillingAsync(tenantId, ct);
        if (billingError is not null) return billingError;

        try
        {
            var detail = await integrations.GetProviderAsync(tenantId, provider, ct);
            return Ok(detail);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("providers/{provider}")]
    [Authorize(Policy = CrmPermissions.IntegrationsWrite)]
    public async Task<ActionResult<object>> UpdateProvider(
        string provider,
        [FromBody] UpdateIntegrationRequest req,
        CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var billingError = await CheckBillingAsync(tenantId, ct);
        if (billingError is not null) return billingError;

        try
        {
            var detail = await integrations.UpsertAsync(tenantId, provider, req, ct);
            await audit.WriteAsync(
                tenantId,
                "integrations.provider.update",
                nameof(TenantIntegration),
                provider,
                null,
                new { detail.IsEnabled, provider },
                ct);
            return Ok(detail);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public sealed class TestIntegrationRequest
    {
        public string? TestEmail { get; set; }
    }

    [HttpPost("providers/{provider}/test")]
    [Authorize(Policy = CrmPermissions.IntegrationsWrite)]
    public async Task<ActionResult<object>> TestProvider(
        string provider,
        [FromBody] TestIntegrationRequest? req,
        CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var billingError = await CheckBillingAsync(tenantId, ct);
        if (billingError is not null) return billingError;

        try
        {
            await integrationTest.TestProviderAsync(tenantId, provider, req?.TestEmail, ct);
            return Ok(new { ok = true, message = "Тест выполнен успешно." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("google-calendar/connect")]
    [Authorize(Policy = CrmPermissions.IntegrationsWrite)]
    public ActionResult<object> GoogleConnect()
    {
        var tenantId = this.RequireTenantId();
        var userId = current.UserId;
        if (userId is null) return Unauthorized();

        if (!googleCalendar.IsOAuthConfigured)
            return BadRequest(new { code = "google.not_configured", message = "Google OAuth не настроен на сервере." });

        var url = googleCalendar.BuildAuthorizationUrl(tenantId, userId.Value);
        return Ok(new { url });
    }

    [HttpGet("google-calendar/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback([FromQuery] string? code, [FromQuery] string? state, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
            return BadRequest("Missing code or state.");

        try
        {
            var redirect = await googleCalendar.HandleCallbackAsync(code, state, ct);
            return Redirect(redirect);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

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

    async Task<ActionResult?> CheckBillingAsync(int tenantId, CancellationToken ct)
    {
        var check = await billing.EnsureFeatureAsync(tenantId, BillingFeature.Integrations, ct);
        return this.ToBillingActionResult(check);
    }
}
