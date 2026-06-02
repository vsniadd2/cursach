using ExpogoCrm.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Services;

public static class NotificationTypes
{
    public const string TaskOverdue = "TaskOverdue";
    public const string TaskDueToday = "TaskDueToday";
    public const string TaskHighPriority = "TaskHighPriority";
    public const string DealStageChanged = "DealStageChanged";
    public const string DealClosingSoon = "DealClosingSoon";
    public const string TeamRoleChanged = "TeamRoleChanged";
    public const string TeamBlocked = "TeamBlocked";
}

public interface INotificationService
{
    Task NotifyUserAsync(
        int tenantId,
        int userId,
        string type,
        string title,
        string body,
        string? entityType = null,
        string? entityId = null,
        string? dedupeKey = null,
        CancellationToken ct = default
    );

    Task NotifyTenantExceptAsync(
        int tenantId,
        int? exceptUserId,
        string type,
        string title,
        string body,
        string? entityType = null,
        string? entityId = null,
        string? dedupeKey = null,
        CancellationToken ct = default
    );

    Task SyncRemindersAsync(int tenantId, int userId, CancellationToken ct = default);
}

public sealed class NotificationService(ExpogoDbContext db) : INotificationService
{
    public async Task NotifyUserAsync(
        int tenantId,
        int userId,
        string type,
        string title,
        string body,
        string? entityType = null,
        string? entityId = null,
        string? dedupeKey = null,
        CancellationToken ct = default
    )
    {
        if (!string.IsNullOrWhiteSpace(dedupeKey))
        {
            var exists = await db.UserNotifications.AnyAsync(
                n => n.UserId == userId && n.DedupeKey == dedupeKey && !n.IsRead,
                ct
            );
            if (exists) return;
        }

        db.UserNotifications.Add(new UserNotification
        {
            TenantId = tenantId,
            UserId = userId,
            Type = type,
            Title = title.Trim(),
            Body = body.Trim(),
            EntityType = entityType,
            EntityId = entityId,
            DedupeKey = dedupeKey,
            IsRead = false,
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task NotifyTenantExceptAsync(
        int tenantId,
        int? exceptUserId,
        string type,
        string title,
        string body,
        string? entityType = null,
        string? entityId = null,
        string? dedupeKey = null,
        CancellationToken ct = default
    )
    {
        var userIds = await db.TenantMemberships.AsNoTracking()
            .Where(x => x.TenantId == tenantId && !x.User.IsBlocked)
            .Select(x => x.UserId)
            .ToListAsync(ct);

        foreach (var userId in userIds)
        {
            if (exceptUserId is not null && userId == exceptUserId.Value)
                continue;

            var key = dedupeKey is null ? null : $"{dedupeKey}:u{userId}";
            await NotifyUserAsync(tenantId, userId, type, title, body, entityType, entityId, key, ct);
        }
    }

    public async Task SyncRemindersAsync(int tenantId, int userId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var soon = today.AddDays(3);

        var overdueTasks = await db.Tasks.AsNoTracking()
            .Where(x => x.TenantId == tenantId && !x.Done && x.Date < today)
            .OrderBy(x => x.Date)
            .Take(20)
            .ToListAsync(ct);

        foreach (var task in overdueTasks)
        {
            await NotifyUserAsync(
                tenantId,
                userId,
                NotificationTypes.TaskOverdue,
                "Просроченная задача",
                $"«{task.Title}» — срок {task.Date:dd.MM.yyyy}",
                nameof(TaskItem),
                task.Id.ToString(),
                $"task-overdue:{task.Id}",
                ct
            );
        }

        var dueToday = await db.Tasks.AsNoTracking()
            .Where(x => x.TenantId == tenantId && !x.Done && x.Date == today)
            .Take(20)
            .ToListAsync(ct);

        foreach (var task in dueToday)
        {
            await NotifyUserAsync(
                tenantId,
                userId,
                NotificationTypes.TaskDueToday,
                "Задача на сегодня",
                $"«{task.Title}»" + (task.Time is not null ? $" в {task.Time:HH\\:mm}" : ""),
                nameof(TaskItem),
                task.Id.ToString(),
                $"task-due-today:{task.Id}:{today:yyyyMMdd}",
                ct
            );
        }

        var closingDeals = await db.Deals.AsNoTracking()
            .Where(x =>
                x.TenantId == tenantId
                && x.Stage != DealStage.Closed
                && x.ExpectedCloseDateUtc != null
                && DateOnly.FromDateTime(x.ExpectedCloseDateUtc.Value) <= soon
            )
            .Take(20)
            .ToListAsync(ct);

        foreach (var deal in closingDeals)
        {
            var closeDate = DateOnly.FromDateTime(deal.ExpectedCloseDateUtc!.Value);
            var overdue = closeDate < today;
            await NotifyUserAsync(
                tenantId,
                userId,
                NotificationTypes.DealClosingSoon,
                overdue ? "Просрочена дата закрытия сделки" : "Скоро закрытие сделки",
                $"«{deal.Title}» — {closeDate:dd.MM.yyyy}",
                nameof(Deal),
                deal.Id.ToString(),
                $"deal-close:{deal.Id}:{closeDate:yyyyMMdd}",
                ct
            );
        }
    }
}
