using System.Text.Json;
using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;

namespace ExpogoCrm.Api.Services;

public interface IAuditTrailService
{
    Task WriteAsync(
        int tenantId,
        string action,
        string entityType,
        string entityId,
        object? beforeSnapshot = null,
        object? afterSnapshot = null,
        CancellationToken ct = default
    );
}

public sealed class AuditTrailService(ExpogoDbContext db, ICurrentTenantAccessor current) : IAuditTrailService
{
    public async Task WriteAsync(
        int tenantId,
        string action,
        string entityType,
        string entityId,
        object? beforeSnapshot = null,
        object? afterSnapshot = null,
        CancellationToken ct = default
    )
    {
        var entry = new AuditLog
        {
            TenantId = tenantId,
            UserId = current.UserId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            BeforeJson = beforeSnapshot is null ? null : JsonSerializer.Serialize(beforeSnapshot),
            AfterJson = afterSnapshot is null ? null : JsonSerializer.Serialize(afterSnapshot),
            CorrelationId = current.CorrelationId,
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.AuditLogs.Add(entry);
        await db.SaveChangesAsync(ct);
    }
}
