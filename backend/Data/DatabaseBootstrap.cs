using ExpogoCrm.Api.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace ExpogoCrm.Api.Data;

public sealed class SeedUserEntry
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string Role { get; set; } = "Member";
}

public static class DatabaseBootstrap
{
    public static async Task SeedAsync(ExpogoDbContext db, IConfiguration configuration, CancellationToken ct = default)
    {
        var tenantName = configuration["DefaultTenant:Name"]?.Trim() ?? "Экспого";
        var tenantSlug = configuration["DefaultTenant:Slug"]?.Trim() ?? "expogo";

        var tenant = await db.Tenants.SingleOrDefaultAsync(x => x.Slug == tenantSlug, ct);
        if (tenant is null)
        {
            tenant = await db.Tenants.SingleOrDefaultAsync(x => x.Slug == "crmgo", ct);
            if (tenant is not null)
            {
                tenant.Slug = tenantSlug;
                tenant.Name = tenantName;
                await db.SaveChangesAsync(ct);
            }
        }

        if (tenant is null)
        {
            tenant = new Tenant
            {
                Name = tenantName,
                Slug = tenantSlug,
                PlanCode = "free",
            };
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync(ct);
        }
        else if (tenant.Name != tenantName)
        {
            tenant.Name = tenantName;
            await db.SaveChangesAsync(ct);
        }

        var hasBilling = await db.BillingSubscriptions.AnyAsync(x => x.TenantId == tenant.Id, ct);
        if (!hasBilling)
        {
            db.BillingSubscriptions.Add(new BillingSubscription
            {
                TenantId = tenant.Id,
                PlanCode = "free",
                Status = "active",
                SeatsLimit = 1,
                StorageGbLimit = 1,
                CurrentPeriodEndUtc = DateTime.UtcNow.AddYears(100),
            });
            await db.SaveChangesAsync(ct);
        }
        else
        {
            var subs = await db.BillingSubscriptions.Where(x => x.TenantId == tenant.Id).ToListAsync(ct);
            foreach (var sub in subs.Where(s => s.PlanCode == "starter"))
            {
                sub.PlanCode = "free";
                sub.SeatsLimit = 1;
                sub.StorageGbLimit = 1;
            }
            if (tenant.PlanCode == "starter")
                tenant.PlanCode = "free";
            if (subs.Count > 0)
                await db.SaveChangesAsync(ct);
        }

        await EnsureDefaultPipelineAsync(db, tenant.Id, ct);

        if (!await db.SupportFaqItems.AnyAsync(x => x.TenantId == null, ct))
        {
            db.SupportFaqItems.AddRange(
                new SupportFaqItem
                {
                    Question = "Как подключить команду?",
                    Answer = "Откройте раздел Команда и назначьте роли участникам.",
                    SortOrder = 1,
                },
                new SupportFaqItem
                {
                    Question = "Как работают стадии сделок?",
                    Answer = "Lead -> Negotiation -> Closed. Переходы валидируются сервером.",
                    SortOrder = 2,
                },
                new SupportFaqItem
                {
                    Question = "Где смотреть аудит?",
                    Answer = "В разделе Аудит доступны последние изменения данных и операций.",
                    SortOrder = 3,
                }
            );
            await db.SaveChangesAsync(ct);
        }

        var entries = configuration.GetSection("SeedUsers").Get<List<SeedUserEntry>>() ?? [];
        foreach (var entry in entries)
        {
            var username = entry.Username?.Trim();
            var password = entry.Password;
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
                continue;

            if (!Enum.TryParse<TenantRole>(entry.Role?.Trim(), ignoreCase: true, out var role))
                role = TenantRole.Member;

            var email = entry.Email?.Trim();
            var fullName = entry.FullName?.Trim();

            var user = await db.Users.SingleOrDefaultAsync(x => x.Username == username, ct);
            if (user is null)
            {
                if (!string.IsNullOrEmpty(email) && await db.Users.AnyAsync(x => x.Email == email, ct))
                    continue;

                user = new AppUser
                {
                    Username = username,
                    FullName = string.IsNullOrEmpty(fullName) ? null : fullName,
                    Email = string.IsNullOrEmpty(email) ? null : email,
                    PasswordHash = PasswordHasher.Hash(password),
                    UiTheme = "light",
                    CurrencyCode = "BYN",
                };
                db.Users.Add(user);
                await db.SaveChangesAsync(ct);
            }

            var membership = await db.TenantMemberships
                .SingleOrDefaultAsync(x => x.TenantId == tenant.Id && x.UserId == user.Id, ct);
            if (membership is null)
            {
                db.TenantMemberships.Add(new TenantMembership
                {
                    TenantId = tenant.Id,
                    UserId = user.Id,
                    Role = role,
                });
                await db.SaveChangesAsync(ct);
            }
        }
    }

    private static async Task EnsureDefaultPipelineAsync(ExpogoDbContext db, int tenantId, CancellationToken ct)
    {
        var pipeline = await db.SalesPipelines
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.IsDefault, ct);

        if (pipeline is null)
        {
            pipeline = new SalesPipeline
            {
                TenantId = tenantId,
                Name = "Основная",
                IsDefault = true,
                CreatedAtUtc = DateTime.UtcNow,
            };
            db.SalesPipelines.Add(pipeline);
            await db.SaveChangesAsync(ct);
        }

        var orphanDeals = await db.Deals
            .Where(x => x.TenantId == tenantId && x.PipelineId == 0)
            .ToListAsync(ct);
        foreach (var deal in orphanDeals)
            deal.PipelineId = pipeline.Id;
        if (orphanDeals.Count > 0)
            await db.SaveChangesAsync(ct);
    }

    public static async Task<Tenant?> FindDefaultTenantAsync(ExpogoDbContext db, IConfiguration configuration, CancellationToken ct = default)
    {
        var tenantSlug = configuration["DefaultTenant:Slug"]?.Trim() ?? "expogo";
        return await db.Tenants.SingleOrDefaultAsync(x => x.Slug == tenantSlug, ct);
    }
}
