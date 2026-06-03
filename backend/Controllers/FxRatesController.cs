using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("fx")]
public class FxRatesController(IFxRatesService fxRates) : ControllerBase
{
    [HttpGet("rates")]
    [AllowAnonymous]
    public async Task<ActionResult<object>> GetRates(CancellationToken ct)
    {
        try
        {
            var snapshot = await fxRates.GetRatesAsync(ct);
            return Ok(new
            {
                baseCurrency = snapshot.Base,
                rates = snapshot.Rates,
                updatedAtUtc = snapshot.UpdatedAtUtc,
            });
        }
        catch (HttpRequestException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Не удалось получить курсы валют. Попробуйте позже.",
            });
        }
    }
}
