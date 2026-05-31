using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;

namespace ExpogoCrm.Api.Security;

public sealed class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}

public sealed class PermissionRequirementHandler(ICurrentTenantAccessor accessor)
    : AuthorizationHandler<PermissionRequirement>
{
    private static readonly Dictionary<TenantRole, HashSet<string>> Matrix = new()
    {
        [TenantRole.Owner] = [.. CrmPermissions.All],
        [TenantRole.Admin] = [.. CrmPermissions.All],
        [TenantRole.Manager] =
        [
            CrmPermissions.ClientsRead, CrmPermissions.ClientsWrite, CrmPermissions.DealsRead, CrmPermissions.DealsWrite,
            CrmPermissions.TasksRead, CrmPermissions.TasksWrite, CrmPermissions.DashboardRead, CrmPermissions.ReportsRead,
            CrmPermissions.SupportRead, CrmPermissions.SupportWrite,
        ],
        [TenantRole.Member] =
        [
            CrmPermissions.ClientsRead, CrmPermissions.ClientsWrite, CrmPermissions.DealsRead, CrmPermissions.DealsWrite,
            CrmPermissions.TasksRead, CrmPermissions.TasksWrite, CrmPermissions.DashboardRead,
            CrmPermissions.SupportRead, CrmPermissions.SupportWrite,
        ],
        [TenantRole.Viewer] =
        [
            CrmPermissions.ClientsRead, CrmPermissions.DealsRead, CrmPermissions.TasksRead, CrmPermissions.DashboardRead,
            CrmPermissions.SupportRead,
        ],
    };

    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (!context.User.Identity?.IsAuthenticated ?? true)
            return Task.CompletedTask;

        var role = accessor.Role;
        if (role is null)
            return Task.CompletedTask;

        if (Matrix.TryGetValue(role.Value, out var allowed) &&
            (allowed.Contains(requirement.Permission) || allowed.Contains(CrmPermissions.Admin)))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
