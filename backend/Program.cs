using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Auth;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text.Json.Serialization;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        // Чтобы клиент мог отправлять/получать enums как строки: "Lead", "High", ...
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddOpenApi();
builder.Services.AddHttpClient(nameof(IntegrationJobsWorker));
builder.Services
    .AddHealthChecks()
    .AddDbContextCheck<ExpogoDbContext>(name: "postgresql", tags: ["ready"]);

builder.Services.AddDbContext<ExpogoDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<IAuditTrailService, AuditTrailService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentTenantAccessor, CurrentTenantAccessor>();
builder.Services.AddHostedService<IntegrationJobsWorker>();

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "Nexara";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "NexaraClient";
var jwtSecret =
    builder.Configuration["Jwt:Secret"]
    ?? "cursach-dev-jwt-secret-key-minimum-32-characters-long";

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(10),
        };
    });

builder.Services.AddAuthorization(options =>
{
    foreach (var permission in CrmPermissions.All)
        options.AddPolicy(permission, p => p.Requirements.Add(new PermissionRequirement(permission)));
});
builder.Services.AddScoped<IAuthorizationHandler, PermissionRequirementHandler>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth-login", httpContext =>
    {
        var key = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            key,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }
        );
    });
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var rawOrigins = builder.Configuration["Cors:AllowedOrigins"];
        if (string.IsNullOrWhiteSpace(rawOrigins))
        {
            policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin();
            return;
        }

        var origins = rawOrigins
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToArray();
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

// Миграции + сид пользователя/тенанта в Development
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ExpogoDbContext>();

    await db.Database.MigrateAsync();

    if (app.Environment.IsDevelopment())
    {
        var seedUsername = builder.Configuration["SeedUser:Username"]?.Trim();
        var seedPassword = builder.Configuration["SeedUser:Password"];
        var seedFullName = builder.Configuration["SeedUser:FullName"]?.Trim();
        var seedEmail = builder.Configuration["SeedUser:Email"]?.Trim();

        if (!string.IsNullOrWhiteSpace(seedUsername) && !string.IsNullOrWhiteSpace(seedPassword))
        {
            var existsByLogin = await db.Users.AnyAsync(x => x.Username == seedUsername);
            if (existsByLogin)
            {
                // уже есть — не перезаписываем
            }
            else if (!string.IsNullOrEmpty(seedEmail) && await db.Users.AnyAsync(x => x.Email == seedEmail))
            {
                // email занят другим пользователем — пропускаем сид, чтобы не ломать уникальный индекс
            }
            else
            {
                db.Users.Add(new AppUser
                {
                    Username = seedUsername,
                    FullName = string.IsNullOrEmpty(seedFullName) ? null : seedFullName,
                    Email = string.IsNullOrEmpty(seedEmail) ? null : seedEmail,
                    PasswordHash = PasswordHasher.Hash(seedPassword),
                    UiTheme = "light",
                    CurrencyCode = "BYN",
                });
                await db.SaveChangesAsync();

                var user = await db.Users.SingleAsync(x => x.Username == seedUsername);
                var tenant = new Tenant
                {
                    Name = $"{seedUsername} workspace",
                    Slug = $"{seedUsername}-{Guid.NewGuid().ToString("N")[..6]}".ToLowerInvariant(),
                    PlanCode = "starter",
                };
                db.Tenants.Add(tenant);
                await db.SaveChangesAsync();
                db.TenantMemberships.Add(new TenantMembership
                {
                    TenantId = tenant.Id,
                    UserId = user.Id,
                    Role = TenantRole.Owner,
                });
                db.BillingSubscriptions.Add(new BillingSubscription
                {
                    TenantId = tenant.Id,
                    PlanCode = "starter",
                    Status = "active",
                    SeatsLimit = 5,
                    StorageGbLimit = 5,
                });
                await db.SaveChangesAsync();
            }
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");
app.MapHealthChecks(
    "/ready",
    new HealthCheckOptions { Predicate = r => r.Tags.Contains("ready") });

app.Run();
