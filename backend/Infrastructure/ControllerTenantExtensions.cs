using ExpogoCrm.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace ExpogoCrm.Api.Infrastructure;

public static class ControllerTenantExtensions
{
    public static int RequireTenantId(this ControllerBase controller)
    {
        if (controller.HttpContext.Items.TryGetValue("tenant_id", out var idObj) && idObj is int tenantId)
            return tenantId;
        throw new UnauthorizedAccessException("Tenant context not resolved.");
    }

    public static TenantRole RequireTenantRole(this ControllerBase controller)
    {
        if (controller.HttpContext.Items.TryGetValue("tenant_role", out var roleObj) && roleObj is TenantRole role)
            return role;
        return TenantRole.Viewer;
    }
}
