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
                PlanCode = "starter",
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
                PlanCode = "starter",
                Status = "active",
                SeatsLimit = 25,
                StorageGbLimit = 10,
            });
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

    public static async Task<Tenant?> FindDefaultTenantAsync(ExpogoDbContext db, IConfiguration configuration, CancellationToken ct = default)
    {
        var tenantSlug = configuration["DefaultTenant:Slug"]?.Trim() ?? "expogo";
        return await db.Tenants.SingleOrDefaultAsync(x => x.Slug == tenantSlug, ct);
    }
}
