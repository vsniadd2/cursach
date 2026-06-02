using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Data;

public class ExpogoDbContext : DbContext
{
    public ExpogoDbContext(DbContextOptions<ExpogoDbContext> options)
        : base(options)
    {
    }

    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<TenantMembership> TenantMemberships => Set<TenantMembership>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Deal> Deals => Set<Deal>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<ActivityEvent> ActivityEvents => Set<ActivityEvent>();
    public DbSet<ContactEvent> ContactEvents => Set<ContactEvent>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AutomationRule> AutomationRules => Set<AutomationRule>();
    public DbSet<WebhookEndpoint> WebhookEndpoints => Set<WebhookEndpoint>();
    public DbSet<IntegrationJob> IntegrationJobs => Set<IntegrationJob>();
    public DbSet<BillingSubscription> BillingSubscriptions => Set<BillingSubscription>();
    public DbSet<UsageMetric> UsageMetrics => Set<UsageMetric>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AppUser>()
            .HasIndex(x => x.Username)
            .IsUnique();

        modelBuilder.Entity<AppUser>()
            .HasIndex(x => x.Email)
            .IsUnique();

        modelBuilder.Entity<Tenant>()
            .HasIndex(x => x.Slug)
            .IsUnique();

        modelBuilder.Entity<AppUser>()
            .Property(x => x.UiTheme)
            .HasDefaultValue("light");

        modelBuilder.Entity<AppUser>()
            .Property(x => x.CurrencyCode)
            .HasDefaultValue("BYN");

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(x => x.TokenHash)
            .IsUnique();

        modelBuilder.Entity<RefreshToken>()
            .HasOne(x => x.User)
            .WithMany(x => x.RefreshTokens)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TenantMembership>()
            .HasOne(x => x.User)
            .WithMany(x => x.Memberships)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TenantMembership>()
            .HasOne(x => x.Tenant)
            .WithMany(x => x.Memberships)
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TenantMembership>()
            .HasIndex(x => new { x.TenantId, x.UserId })
            .IsUnique();

        modelBuilder.Entity<Client>()
            .HasMany(x => x.Deals)
            .WithOne(x => x.Client)
            .HasForeignKey(x => x.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Client>()
            .HasOne(x => x.Tenant)
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Client>()
            .HasMany(x => x.ContactEvents)
            .WithOne(x => x.Client)
            .HasForeignKey(x => x.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Deal>()
            .HasOne(x => x.Tenant)
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaskItem>()
            .HasOne(x => x.Tenant)
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ActivityEvent>()
            .HasOne(x => x.Tenant)
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ContactEvent>()
            .HasOne(x => x.Tenant)
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaskItem>()
            .HasIndex(x => new { x.TenantId, x.Date });

        modelBuilder.Entity<Deal>()
            .HasIndex(x => new { x.TenantId, x.Stage });

        modelBuilder.Entity<Client>()
            .HasIndex(x => new { x.TenantId, x.Company, x.FullName });

        modelBuilder.Entity<Deal>()
            .HasIndex(x => new { x.TenantId, x.ClientId, x.Stage });

        modelBuilder.Entity<ActivityEvent>()
            .HasIndex(x => new { x.TenantId, x.CreatedAtUtc });

        modelBuilder.Entity<ContactEvent>()
            .HasIndex(x => new { x.TenantId, x.ClientId, x.OccurredAtUtc });

        modelBuilder.Entity<AuditLog>()
            .HasIndex(x => new { x.TenantId, x.CreatedAtUtc });

        modelBuilder.Entity<IntegrationJob>()
            .HasIndex(x => new { x.TenantId, x.Status, x.ScheduledAtUtc });

        modelBuilder.Entity<UsageMetric>()
            .HasIndex(x => new { x.TenantId, x.MetricKey, x.RecordedAtUtc });

        modelBuilder.Entity<BillingSubscription>()
            .HasIndex(x => x.TenantId)
            .IsUnique();

        modelBuilder.Entity<AutomationRule>()
            .HasIndex(x => new { x.TenantId, x.Trigger, x.IsEnabled });

        modelBuilder.Entity<WebhookEndpoint>()
            .HasIndex(x => new { x.TenantId, x.IsActive });

        modelBuilder.Entity<SupportTicket>()
            .HasIndex(x => new { x.TenantId, x.Status, x.CreatedAtUtc });

        modelBuilder.Entity<UserNotification>()
            .HasOne(x => x.Tenant)
            .WithMany()
            .HasForeignKey(x => x.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserNotification>()
            .HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserNotification>()
            .HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAtUtc });

        modelBuilder.Entity<UserNotification>()
            .HasIndex(x => new { x.TenantId, x.UserId, x.DedupeKey });
    }
}
