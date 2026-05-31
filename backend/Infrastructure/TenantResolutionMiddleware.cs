using ExpogoCrm.Api.Data;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ExpogoCrm.Api.Infrastructure;

public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ExpogoDbContext db)
    {
        context.Items["correlation_id"] = context.TraceIdentifier;

        if (context.User.Identity?.IsAuthenticated != true)
        {
            await next(context);
            return;
        }

        var sub = context.User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(sub, out var userId))
        {
            await next(context);
            return;
        }

        var memberships = db.TenantMemberships.AsNoTracking().Where(x => x.UserId == userId);
        var tenantHeader = context.Request.Headers["X-Tenant-Id"].FirstOrDefault();

        TenantMembership? membership = null;
        if (int.TryParse(tenantHeader, out var requestedTenantId))
            membership = await memberships.FirstOrDefaultAsync(x => x.TenantId == requestedTenantId);

        membership ??= await memberships.OrderBy(x => x.TenantId).FirstOrDefaultAsync();
        if (membership is not null)
        {
            context.Items["tenant_id"] = membership.TenantId;
            context.Items["tenant_role"] = membership.Role;
        }

        await next(context);
    }
}
