using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExpogoCrm.Api.Controllers.More;

[ApiController]
[Route("cloud-storage")]
[Authorize]
public class CloudStorageController(
    ICloudStorageService storage,
    ICurrentTenantAccessor tenant) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CrmPermissions.CloudStorageRead)]
    public async Task<ActionResult<object>> List(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var overview = await storage.GetOverviewAsync(tenantId, ct);
        return Ok(new
        {
            quota = new
            {
                overview.StorageGbPerSeat,
                overview.ActiveSeats,
                storageGbTotalLimit = overview.StorageGbTotalLimit,
                storageGbUsed = overview.StorageGbUsed,
                limitBytes = overview.LimitBytes,
                usedBytes = overview.UsedBytes,
            },
            items = overview.Items,
        });
    }

    [HttpPost("upload")]
    [Authorize(Policy = CrmPermissions.CloudStorageWrite)]
    [RequestSizeLimit(104_857_600)]
    public async Task<ActionResult<object>> Upload(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Выберите файл для загрузки." });

        var tenantId = this.RequireTenantId();
        var userId = tenant.UserId;
        if (userId is null)
            return Unauthorized();

        try
        {
            await using var stream = file.OpenReadStream();
            var created = await storage.UploadAsync(
                tenantId,
                userId.Value,
                file.FileName,
                file.ContentType,
                stream,
                ct);
            return Ok(created);
        }
        catch (BillingLimitException ex)
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new { code = ex.Code, message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{fileId:long}")]
    [Authorize(Policy = CrmPermissions.CloudStorageWrite)]
    public async Task<ActionResult> Delete(long fileId, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        try
        {
            await storage.DeleteAsync(tenantId, fileId, ct);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Файл не найден." });
        }
    }

    [HttpGet("{fileId:long}/download")]
    [Authorize(Policy = CrmPermissions.CloudStorageRead)]
    public async Task<IActionResult> Download(long fileId, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        try
        {
            var (meta, path) = await storage.GetFileForDownloadAsync(tenantId, fileId, ct);
            return PhysicalFile(path, meta.ContentType, meta.FileName);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "Файл не найден." });
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { message = "Файл на диске не найден." });
        }
    }
}
