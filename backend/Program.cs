using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Auth;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using ExpogoCrm.Api.Services.Ai;
using ExpogoCrm.Api.Services.Integrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using System.Text.Json.Serialization;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using System.Globalization;

CultureInfo.DefaultThreadCurrentCulture = new CultureInfo("ru-RU");
CultureInfo.DefaultThreadCurrentUICulture = new CultureInfo("ru-RU");

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        // Чтобы клиент мог отправлять/получать enums как строки: "Lead", "High", ...
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddOpenApi();
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient(nameof(IntegrationJobsWorker));
builder.Services.AddHttpClient(nameof(FxRatesService));
builder.Services.AddSingleton<IFxRatesService, FxRatesService>();
builder.Services
    .AddHealthChecks()
    .AddDbContextCheck<ExpogoDbContext>(name: "postgresql", tags: ["ready"]);

builder.Services.AddDbContext<ExpogoDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<IBillingEntitlementsService, BillingEntitlementsService>();
builder.Services.Configure<CloudStorageOptions>(builder.Configuration.GetSection(CloudStorageOptions.SectionName));
builder.Services.AddScoped<ICloudStorageService, CloudStorageService>();
builder.Services.AddScoped<IDemoSeedService, DemoSeedService>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<IAuditTrailService, AuditTrailService>();
builder.Services.AddSingleton<IPaymentReceiptPdfService, PaymentReceiptPdfService>();
builder.Services.AddScoped<IReportsAnalyticsService, ReportsAnalyticsService>();
builder.Services.AddSingleton<IReportsPdfService, ReportsPdfService>();
builder.Services.Configure<AiLlmOptions>(builder.Configuration.GetSection(AiLlmOptions.SectionName));
builder.Services.PostConfigure<AiLlmOptions>(options =>
{
    var envKey = builder.Configuration["OPENROUTER_API_KEY"];
    if (!string.IsNullOrWhiteSpace(envKey))
        options.ApiKey = envKey.Trim();
});
builder.Services.AddHttpClient<OpenAiChatLlmClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(180);
});
builder.Services.AddHttpClient(nameof(TelegramIntegrationClient));
builder.Services.AddHttpClient(nameof(GoogleCalendarIntegrationService));
builder.Services.Configure<GoogleIntegrationOptions>(builder.Configuration.GetSection(GoogleIntegrationOptions.SectionName));
builder.Services.PostConfigure<GoogleIntegrationOptions>(options =>
{
    var clientId = builder.Configuration["GOOGLE_OAUTH_CLIENT_ID"]
        ?? builder.Configuration["Integrations:Google:ClientId"];
    if (!string.IsNullOrWhiteSpace(clientId))
        options.ClientId = clientId.Trim();

    var clientSecret = builder.Configuration["GOOGLE_OAUTH_CLIENT_SECRET"]
        ?? builder.Configuration["Integrations:Google:ClientSecret"];
    if (!string.IsNullOrWhiteSpace(clientSecret))
        options.ClientSecret = clientSecret.Trim();
});
builder.Services.AddScoped<ITenantIntegrationService, TenantIntegrationService>();
builder.Services.AddSingleton<ITelegramIntegrationClient, TelegramIntegrationClient>();
builder.Services.AddSingleton<ISmtpEmailIntegrationClient, SmtpEmailIntegrationClient>();
builder.Services.AddScoped<IGoogleCalendarIntegrationService, GoogleCalendarIntegrationService>();
builder.Services.AddScoped<IIntegrationTestService, IntegrationTestService>();
builder.Services.AddSingleton<IIntegrationDispatchService, IntegrationDispatchService>();
builder.Services.AddScoped<IAiAdvisorContextService, AiAdvisorContextService>();
builder.Services.AddScoped<IAiAdvisorService, AiAdvisorService>();
builder.Services.AddScoped<IAiAdvisorChatService, AiAdvisorChatService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
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
    options.AddPolicy("ai-advisor", httpContext =>
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
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().SetPreflightMaxAge(TimeSpan.FromHours(1));
    });
});

var app = builder.Build();

// Миграции + сид default tenant и пользователей admin/user
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ExpogoDbContext>();
    await db.Database.MigrateAsync();
    await db.Database.ExecuteSqlRawAsync(
        """
        ALTER TABLE "Clients" ADD COLUMN IF NOT EXISTS "AvatarHue" integer NOT NULL DEFAULT 0;
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260603120000_AddClientAvatarHue', '10.0.5')
        ON CONFLICT ("MigrationId") DO NOTHING;
        """);
    await DatabaseBootstrap.SeedAsync(db, builder.Configuration);

    if (builder.Configuration.GetValue("Seed:RunDemoOnStartup", false))
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("StartupSeed");
        var slug = builder.Configuration["DefaultTenant:Slug"]?.Trim() ?? "expogo";
        var tenantId = await db.Tenants.AsNoTracking()
            .Where(t => t.Slug == slug)
            .Select(t => t.Id)
            .SingleOrDefaultAsync();
        if (tenantId == 0)
        {
            logger.LogWarning("Demo seed skipped: tenant {Slug} not found", slug);
        }
        else
        {
            var forceCrm = builder.Configuration.GetValue("Seed:ForceCrmOnStartup", false);
            var demoSeed = scope.ServiceProvider.GetRequiredService<IDemoSeedService>();
            var result = await demoSeed.SeedAsync(tenantId, forceCrm);
            if (result.CrmSeeded)
            {
                logger.LogInformation(
                    "Demo CRM seeded: {Clients} clients, {Deals} deals, {Tasks} tasks ({Users} users)",
                    result.Clients,
                    result.Deals,
                    result.Tasks,
                    result.UsersUpserted);
            }
            else if (result.CrmSkipped)
            {
                logger.LogInformation(
                    "Demo CRM already present — skipped (set Seed:ForceCrmOnStartup=true to replace)");
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
