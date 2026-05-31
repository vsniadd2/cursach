using ExpogoCrm.Api.Data;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace ExpogoCrm.Api.Infrastructure;

public interface ICurrentTenantAccessor
{
    int? TenantId { get; }
    TenantRole? Role { get; }
    int? UserId { get; }
    string? CorrelationId { get; }
}

public sealed class CurrentTenantAccessor(IHttpContextAccessor http) : ICurrentTenantAccessor
{
    public int? TenantId => http.HttpContext?.Items.TryGetValue("tenant_id", out var id) == true ? id as int? : null;
    public TenantRole? Role => http.HttpContext?.Items.TryGetValue("tenant_role", out var role) == true ? role as TenantRole? : null;
    public string? CorrelationId => http.HttpContext?.Items.TryGetValue("correlation_id", out var c) == true ? c as string : null;

    public int? UserId
    {
        get
        {
            var user = http.HttpContext?.User;
            var sub = user?.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? user?.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(sub, out var id) ? id : null;
        }
    }
}
