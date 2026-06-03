using Microsoft.AspNetCore.Mvc;

namespace ExpogoCrm.Api.Infrastructure;

public static class BillingControllerExtensions
{
    public static ActionResult? ToBillingActionResult(this ControllerBase controller, BillingCheckResult check)
    {
        if (check.Allowed)
            return null;

        return controller.StatusCode(StatusCodes.Status403Forbidden, new { code = check.Code, message = check.Message });
    }
}
