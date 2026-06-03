using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("reports")]
[Authorize]
public class ReportsController(
    IReportsAnalyticsService analytics,
    IReportsPdfService pdf,
    IBillingEntitlementsService billing) : ControllerBase
{
    [HttpGet("summary")]
    [Authorize(Policy = CrmPermissions.ReportsRead)]
    public async Task<ActionResult<object>> Summary(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var reportsCheck = await billing.EnsureFeatureAsync(tenantId, BillingFeature.Reports, ct);
        var reportsError = this.ToBillingActionResult(reportsCheck);
        if (reportsError is not null)
            return reportsError;

        var d = await analytics.BuildAsync(tenantId, ct);

        if (d.QuarterRevenueUsd is null)
        {
            return Ok(new
            {
                d.Tier,
                totalDeals = d.TotalDeals,
                closedDeals = d.ClosedDeals,
                conversionPct = d.ConversionPct,
                monthRevenueUsd = d.MonthRevenueUsd,
                overdueTasks = d.OverdueTasks,
            });
        }

        return Ok(new
        {
            d.Tier,
            totalDeals = d.TotalDeals,
            closedDeals = d.ClosedDeals,
            conversionPct = d.ConversionPct,
            monthRevenueUsd = d.MonthRevenueUsd,
            quarterRevenueUsd = d.QuarterRevenueUsd,
            overdueTasks = d.OverdueTasks,
        });
    }

    [HttpGet("export.pdf")]
    [Authorize(Policy = CrmPermissions.ReportsRead)]
    public async Task<IActionResult> ExportPdf(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var reportsCheck = await billing.EnsureFeatureAsync(tenantId, BillingFeature.Reports, ct);
        var reportsError = this.ToBillingActionResult(reportsCheck);
        if (reportsError is not null)
            return reportsError;

        var data = await analytics.BuildAsync(tenantId, ct);
        var bytes = pdf.BuildPdf(data);
        var fileName = $"expogo-report-{data.GeneratedAtUtc:yyyyMMdd}.pdf";
        return File(bytes, "application/pdf", fileName);
    }
}
