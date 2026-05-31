using System.ComponentModel.DataAnnotations;

namespace ExpogoCrm.Api.Data;

public enum TenantRole
{
    Owner = 0,
    Admin = 1,
    Manager = 2,
    Member = 3,
    Viewer = 4,
}

public class Tenant
{
    public int Id { get; set; }

    [MaxLength(128)]
    public required string Name { get; set; }

    [MaxLength(96)]
    public required string Slug { get; set; }

    [MaxLength(32)]
    public string PlanCode { get; set; } = "starter";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<TenantMembership> Memberships { get; set; } = [];
}

public class AppUser
{
    public int Id { get; set; }

    [MaxLength(64)]
    public required string Username { get; set; }

    [MaxLength(128)]
    public string? FullName { get; set; }

    [MaxLength(128)]
    public string? Email { get; set; }

    [MaxLength(512)]
    public required string PasswordHash { get; set; }

    /// <summary>Светлая / тёмная тема UI: light | dark.</summary>
    [MaxLength(16)]
    public string UiTheme { get; set; } = "light";

    /// <summary>ISO 4217 для отображения сумм (набор допустимых кодов — в AuthMeController).</summary>
    [MaxLength(8)]
    public string CurrencyCode { get; set; } = "BYN";

    public int FailedLoginAttempts { get; set; }
    public DateTime? LockoutEndUtc { get; set; }

    /// <summary>Ручная блокировка администратором.</summary>
    public bool IsBlocked { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<RefreshToken> RefreshTokens { get; set; } = [];
    public List<TenantMembership> Memberships { get; set; } = [];
}

public class TenantMembership
{
    public int Id { get; set; }

    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public int UserId { get; set; }
    public AppUser User { get; set; } = null!;

    public TenantRole Role { get; set; } = TenantRole.Member;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class RefreshToken
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public AppUser User { get; set; } = null!;

    [MaxLength(128)]
    public required string TokenHash { get; set; }

    public DateTime ExpiresAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? RevokedAtUtc { get; set; }
    public DateTime? ReplacedAtUtc { get; set; }

    [MaxLength(128)]
    public string? ReplacedByTokenHash { get; set; }
}

public class Client
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    [MaxLength(128)]
    public required string FullName { get; set; }

    [MaxLength(128)]
    public required string Company { get; set; }

    [MaxLength(128)]
    public string? RoleTitle { get; set; }

    [MaxLength(32)]
    public string? Phone { get; set; }

    [MaxLength(128)]
    public string? WorkEmail { get; set; }

    [MaxLength(512)]
    public string? AvatarLargeUrl { get; set; }

    [MaxLength(512)]
    public string? AvatarSmallUrl { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<Deal> Deals { get; set; } = [];
    public List<ContactEvent> ContactEvents { get; set; } = [];
}

public enum DealStage
{
    Lead = 0,
    Negotiation = 1,
    Closed = 2,
}

public class Deal
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public int ClientId { get; set; }
    public Client Client { get; set; } = null!;

    [MaxLength(160)]
    public required string Title { get; set; }

    public DealStage Stage { get; set; }

    /// <summary>Сумма сделки в USD (в UI пересчитывается в валюту профиля).</summary>
    public decimal Amount { get; set; }

    public int ProbabilityPct { get; set; }

    public DateTime? ExpectedCloseDateUtc { get; set; }

    [MaxLength(128)]
    public string? DecisionMaker { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public enum TaskPriority
{
    Low = 0,
    Medium = 1,
    High = 2,
}

public class TaskItem
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public DateOnly Date { get; set; }

    [MaxLength(160)]
    public required string Title { get; set; }

    [MaxLength(512)]
    public string? Description { get; set; }

    [MaxLength(64)]
    public string? AssigneeName { get; set; }

    public TimeOnly? Time { get; set; }

    public TaskPriority Priority { get; set; }

    public bool Done { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class ActivityEvent
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    [MaxLength(128)]
    public required string Title { get; set; }

    [MaxLength(256)]
    public required string Description { get; set; }

    [MaxLength(512)]
    public string? AvatarUrl { get; set; }

    [MaxLength(64)]
    public string? BadgeIcon { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class ContactEvent
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public int ClientId { get; set; }
    public Client Client { get; set; } = null!;

    [MaxLength(160)]
    public required string Title { get; set; }

    [MaxLength(1024)]
    public string? Body { get; set; }

    public DateTime OccurredAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class AuditLog
{
    public long Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public int? UserId { get; set; }
    public AppUser? User { get; set; }

    [MaxLength(80)]
    public required string Action { get; set; }

    [MaxLength(80)]
    public required string EntityType { get; set; }

    [MaxLength(64)]
    public required string EntityId { get; set; }

    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }

    [MaxLength(64)]
    public string? CorrelationId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class AutomationRule
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    [MaxLength(128)]
    public required string Name { get; set; }

    [MaxLength(64)]
    public required string Trigger { get; set; }

    [MaxLength(64)]
    public required string Action { get; set; }

    public string? ConfigJson { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class WebhookEndpoint
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    [MaxLength(128)]
    public required string Name { get; set; }

    [MaxLength(512)]
    public required string Url { get; set; }

    [MaxLength(128)]
    public required string Secret { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public enum IntegrationJobStatus
{
    Pending = 0,
    Processing = 1,
    Succeeded = 2,
    Failed = 3,
}

public class IntegrationJob
{
    public long Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    [MaxLength(64)]
    public required string JobType { get; set; }

    public string? PayloadJson { get; set; }
    public IntegrationJobStatus Status { get; set; } = IntegrationJobStatus.Pending;
    public int Attempts { get; set; }
    public DateTime ScheduledAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAtUtc { get; set; }
    public string? LastError { get; set; }
}

public class BillingSubscription
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    [MaxLength(32)]
    public string PlanCode { get; set; } = "starter";

    [MaxLength(32)]
    public string Status { get; set; } = "active";

    public int SeatsLimit { get; set; } = 5;
    public int StorageGbLimit { get; set; } = 5;
    public DateTime CurrentPeriodStartUtc { get; set; } = DateTime.UtcNow;
    public DateTime CurrentPeriodEndUtc { get; set; } = DateTime.UtcNow.AddMonths(1);
}

public class UsageMetric
{
    public long Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    [MaxLength(64)]
    public required string MetricKey { get; set; }

    public decimal Value { get; set; }
    public DateTime RecordedAtUtc { get; set; } = DateTime.UtcNow;
}

public class SupportTicket
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public int UserId { get; set; }
    public AppUser User { get; set; } = null!;

    [MaxLength(160)]
    public required string Subject { get; set; }
    [MaxLength(3000)]
    public required string Body { get; set; }

    [MaxLength(32)]
    public string Status { get; set; } = "open";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

