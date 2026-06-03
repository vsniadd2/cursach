using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("seed")]
[Authorize]
public class SeedController(IDemoSeedService demoSeed) : ControllerBase
{
    /// <summary>Демо-данные: команда (6 пользователей) + клиенты, сделки, задачи.</summary>
    [HttpPost("demo")]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public async Task<ActionResult<object>> Demo([FromQuery] bool forceCrm = false, CancellationToken ct = default)
    {
        var tenantId = this.RequireTenantId();
        var result = await demoSeed.SeedAsync(tenantId, forceCrm, ct);
        return Ok(new
        {
            result.TeamEnsured,
            result.UsersUpserted,
            result.CrmSeeded,
            result.CrmSkipped,
            clients = result.Clients,
            deals = result.Deals,
            tasks = result.Tasks,
        });
    }

    [HttpPost("run")]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public Task<ActionResult<object>> Run(CancellationToken ct) => Demo(forceCrm: false, ct);
}
