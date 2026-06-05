using System.Text.Json;
using ExpogoCrm.Api.Auth;
using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace ExpogoCrm.Api.Services;

public sealed class DemoSeedResult
{
    public bool TeamEnsured { get; init; }
    public int UsersUpserted { get; init; }
    public bool CrmSeeded { get; init; }
    public bool CrmSkipped { get; init; }
    public int Clients { get; init; }
    public int Deals { get; init; }
    public int Tasks { get; init; }
}

public interface IDemoSeedService
{
    Task<DemoSeedResult> SeedAsync(int tenantId, bool forceCrm, CancellationToken ct = default);
}

public class DemoSeedService(ExpogoDbContext db, IConfiguration configuration) : IDemoSeedService
{
    public async Task<DemoSeedResult> SeedAsync(int tenantId, bool forceCrm, CancellationToken ct = default)
    {
        await EnsureDemoProPlanAsync(tenantId, ct);
        var usersUpserted = await EnsureTeamUsersAsync(tenantId, ct);
        await EnsureAuditSampleAsync(tenantId, ct);

        var hasCrm = await db.Clients.AnyAsync(x => x.TenantId == tenantId, ct)
            || await db.Deals.AnyAsync(x => x.TenantId == tenantId, ct)
            || await db.Tasks.AnyAsync(x => x.TenantId == tenantId, ct);

        if (hasCrm && !forceCrm)
        {
            return new DemoSeedResult
            {
                TeamEnsured = true,
                UsersUpserted = usersUpserted,
                CrmSkipped = true,
            };
        }

        if (forceCrm && hasCrm)
            await ClearTenantCrmAsync(tenantId, ct);

        var (clients, deals, tasks) = await SeedCrmAsync(tenantId, ct);

        return new DemoSeedResult
        {
            TeamEnsured = true,
            UsersUpserted = usersUpserted,
            CrmSeeded = true,
            Clients = clients,
            Deals = deals,
            Tasks = tasks,
        };
    }

    private async Task<int> EnsureTeamUsersAsync(int tenantId, CancellationToken ct)
    {
        var entries = configuration.GetSection("SeedUsers").Get<List<SeedUserEntry>>() ?? [];
        var count = 0;

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
                };
                db.Users.Add(user);
                await db.SaveChangesAsync(ct);
            }
            else
            {
                if (!string.IsNullOrEmpty(fullName))
                    user.FullName = fullName;
                if (!string.IsNullOrEmpty(email))
                    user.Email = email;
                user.PasswordHash = PasswordHasher.Hash(password);
                await db.SaveChangesAsync(ct);
            }

            var membership = await db.TenantMemberships
                .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == user.Id, ct);
            if (membership is null)
            {
                db.TenantMemberships.Add(new TenantMembership
                {
                    TenantId = tenantId,
                    UserId = user.Id,
                    Role = role,
                });
                await db.SaveChangesAsync(ct);
            }
            else if (membership.Role != role)
            {
                membership.Role = role;
                await db.SaveChangesAsync(ct);
            }

            count++;
        }

        return count;
    }

    /// <summary>ИИ-советник и интеграции доступны на PRO/TEAM — для демо поднимаем тариф.</summary>
    private async Task EnsureDemoProPlanAsync(int tenantId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var sub = await db.BillingSubscriptions.SingleOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (sub is null)
        {
            db.BillingSubscriptions.Add(new BillingSubscription
            {
                TenantId = tenantId,
                PlanCode = "pro",
                Status = "active",
                SeatsLimit = 10,
                StorageGbLimit = 10,
                CurrentPeriodStartUtc = now,
                CurrentPeriodEndUtc = now.AddMonths(1),
            });
        }
        else
        {
            sub.PlanCode = "pro";
            sub.Status = "active";
        }

        var tenant = await db.Tenants.SingleAsync(x => x.Id == tenantId, ct);
        tenant.PlanCode = "pro";
        await db.SaveChangesAsync(ct);
    }

    private async Task ClearTenantCrmAsync(int tenantId, CancellationToken ct)
    {
        var deals = await db.Deals.Where(x => x.TenantId == tenantId).ToListAsync(ct);
        db.Deals.RemoveRange(deals);

        var contactEvents = await db.ContactEvents.Where(x => x.TenantId == tenantId).ToListAsync(ct);
        db.ContactEvents.RemoveRange(contactEvents);

        var clients = await db.Clients.Where(x => x.TenantId == tenantId).ToListAsync(ct);
        db.Clients.RemoveRange(clients);

        var tasks = await db.Tasks.Where(x => x.TenantId == tenantId).ToListAsync(ct);
        db.Tasks.RemoveRange(tasks);

        var activities = await db.ActivityEvents.Where(x => x.TenantId == tenantId).ToListAsync(ct);
        db.ActivityEvents.RemoveRange(activities);

        await db.SaveChangesAsync(ct);
    }

    private async Task<(int clients, int deals, int tasks)> SeedCrmAsync(int tenantId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var prevMonthMid = monthStart.AddMonths(-1).AddDays(14);

        var clientSpecs = new[]
        {
            ("Александр Стерлинг", "Zenith Global", "Операционный директор", "+375291112233", "a.sterling@zenith.example"),
            ("Сара Дженкинс", "Apex Corp", "Head of Procurement", "+375299998877", "s.jenkins@apex.example"),
            ("Михаил Орлов", "БелТех Плюс", "Коммерческий директор", "+375331234567", "m.orlov@beltech.example"),
            ("Анна Кравцова", "Nordic Logistics", "CEO", "+375441112233", "a.kravtsova@nordic.example"),
            ("Пётр Лебедев", "GreenField", "IT-директор", "+375251234567", "p.lebedev@greenfield.example"),
            ("Ольга Смирнова", "MedCore", "Закупки", "+375291234567", "o.smirnova@medcore.example"),
            ("Виктор Громов", "FinBridge", "CFO", "+375339876543", "v.gromov@finbridge.example"),
            ("Ирина Павлова", "RetailPro", "Маркетинг", "+375441234567", "i.pavlova@retailpro.example"),
        };

        var clients = clientSpecs.Select(c => new Client
        {
            TenantId = tenantId,
            FullName = c.Item1,
            Company = c.Item2,
            RoleTitle = c.Item3,
            Phone = c.Item4,
            WorkEmail = c.Item5,
        }).ToList();

        db.Clients.AddRange(clients);
        await db.SaveChangesAsync(ct);
        foreach (var client in clients)
            client.AvatarHue = ClientAvatarColor.AssignHue(client.Id, client.FullName, client.Company);
        await db.SaveChangesAsync(ct);

        var defaultPipeline = await db.SalesPipelines
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.IsDefault, ct);
        if (defaultPipeline is null)
        {
            defaultPipeline = new SalesPipeline
            {
                TenantId = tenantId,
                Name = "Основная",
                IsDefault = true,
                CreatedAtUtc = DateTime.UtcNow,
            };
            db.SalesPipelines.Add(defaultPipeline);
            await db.SaveChangesAsync(ct);
        }

        var pipelineId = defaultPipeline.Id;
        var deals = new List<Deal>
        {
            // Lead
            new() { TenantId = tenantId, ClientId = clients[0].Id, PipelineId = pipelineId, Title = "Пилот платформы CRM", Stage = DealStage.Lead, Amount = 3200m, ProbabilityPct = 20, ExpectedCloseDateUtc = now.AddDays(45) },
            new() { TenantId = tenantId, ClientId = clients[1].Id, PipelineId = pipelineId, Title = "Расширение Quantum Systems", Stage = DealStage.Lead, Amount = 2500m, ProbabilityPct = 25, ExpectedCloseDateUtc = now.AddDays(60) },
            new() { TenantId = tenantId, ClientId = clients[2].Id, PipelineId = pipelineId, Title = "Аудит процессов продаж", Stage = DealStage.Lead, Amount = 1800m, ProbabilityPct = 15, ExpectedCloseDateUtc = now.AddDays(30) },
            new() { TenantId = tenantId, ClientId = clients[3].Id, PipelineId = pipelineId, Title = "Инфраструктура, фаза II", Stage = DealStage.Lead, Amount = 6042m, ProbabilityPct = 30, ExpectedCloseDateUtc = now.AddDays(90) },
            // Negotiation
            new() { TenantId = tenantId, ClientId = clients[0].Id, PipelineId = pipelineId, Title = "Лицензия основной платформы", Stage = DealStage.Negotiation, Amount = 12500m, ProbabilityPct = 75, ExpectedCloseDateUtc = now.AddDays(30), DecisionMaker = "Стерлинг А." },
            new() { TenantId = tenantId, ClientId = clients[4].Id, PipelineId = pipelineId, Title = "Внедрение модуля аналитики", Stage = DealStage.Negotiation, Amount = 8900m, ProbabilityPct = 60, ExpectedCloseDateUtc = now.AddDays(21) },
            new() { TenantId = tenantId, ClientId = clients[5].Id, PipelineId = pipelineId, Title = "Поддержка 12 месяцев", Stage = DealStage.Negotiation, Amount = 4200m, ProbabilityPct = 55, ExpectedCloseDateUtc = now.AddDays(14) },
            new() { TenantId = tenantId, ClientId = clients[6].Id, PipelineId = pipelineId, Title = "Интеграция с 1С", Stage = DealStage.Negotiation, Amount = 7600m, ProbabilityPct = 50, ExpectedCloseDateUtc = now.AddDays(40) },
            // Closed — текущий месяц
            new() { TenantId = tenantId, ClientId = clients[1].Id, PipelineId = pipelineId, Title = "Премиум-расширение", Stage = DealStage.Closed, Amount = 9800m, ProbabilityPct = 100, CreatedAtUtc = monthStart.AddDays(5) },
            new() { TenantId = tenantId, ClientId = clients[0].Id, PipelineId = pipelineId, Title = "Интеграция цепочки поставок", Stage = DealStage.Closed, Amount = 885m, ProbabilityPct = 100, CreatedAtUtc = monthStart.AddDays(12) },
            new() { TenantId = tenantId, ClientId = clients[7].Id, PipelineId = pipelineId, Title = "Обучение команды", Stage = DealStage.Closed, Amount = 1500m, ProbabilityPct = 100, CreatedAtUtc = monthStart.AddDays(18) },
            // Closed — прошлый месяц (для роста на дашборде)
            new() { TenantId = tenantId, ClientId = clients[2].Id, PipelineId = pipelineId, Title = "Стартовый пакет", Stage = DealStage.Closed, Amount = 5200m, ProbabilityPct = 100, CreatedAtUtc = prevMonthMid },
            new() { TenantId = tenantId, ClientId = clients[3].Id, PipelineId = pipelineId, Title = "Консалтинг Q1", Stage = DealStage.Closed, Amount = 3100m, ProbabilityPct = 100, CreatedAtUtc = prevMonthMid.AddDays(5) },
        };

        db.Deals.AddRange(deals);

        var tasks = new List<TaskItem>
        {
            new() { TenantId = tenantId, Date = today, Title = "Квартальный разбор с Apex Corp", Description = "Разобрать воронку и условия продления.", Time = new TimeOnly(9, 30), AssigneeName = "Мария Козлова", Priority = TaskPriority.High, Done = false },
            new() { TenantId = tenantId, Date = today, Title = "Письма новым лидам", Description = "Отправить материалы 5 тёплым лидам.", Time = new TimeOnly(11, 0), AssigneeName = "Дмитрий Волков", Priority = TaskPriority.Medium, Done = false },
            new() { TenantId = tenantId, Date = today, Title = "Черновик сводки для руководства", Time = new TimeOnly(8, 0), AssigneeName = "Иван Петров", Priority = TaskPriority.Medium, Done = true },
            new() { TenantId = tenantId, Date = today.AddDays(1), Title = "Звонок клиенту Zenith Global", AssigneeName = "Елена Морозова", Priority = TaskPriority.High, Done = false },
            new() { TenantId = tenantId, Date = today.AddDays(2), Title = "Подготовить КП для FinBridge", AssigneeName = "Алексей Новиков", Priority = TaskPriority.Medium, Done = false },
            new() { TenantId = tenantId, Date = today.AddDays(3), Title = "Встреча с Nordic Logistics", Time = new TimeOnly(14, 0), AssigneeName = "Наталья Сидорова", Priority = TaskPriority.High, Done = false },
            new() { TenantId = tenantId, Date = today.AddDays(-1), Title = "Отправить договор MedCore", AssigneeName = "Мария Козлова", Priority = TaskPriority.Medium, Done = false },
            new() { TenantId = tenantId, Date = today.AddDays(-2), Title = "Обновить прогноз продаж", AssigneeName = "Дмитрий Волков", Priority = TaskPriority.Low, Done = false },
            new() { TenantId = tenantId, Date = today.AddDays(-3), Title = "Согласовать скидку RetailPro", AssigneeName = "Елена Морозова", Priority = TaskPriority.High, Done = true },
            new() { TenantId = tenantId, Date = today.AddDays(7), Title = "Демо для GreenField", Time = new TimeOnly(10, 30), AssigneeName = "Алексей Новиков", Priority = TaskPriority.Medium, Done = false },
            new() { TenantId = tenantId, Date = today.AddDays(-5), Title = "Просроченный follow-up", Description = "Напомнить о коммерческом предложении.", AssigneeName = "Наталья Сидорова", Priority = TaskPriority.High, Done = false },
            new() { TenantId = tenantId, Date = today, Title = "Проверить воронку сделок", AssigneeName = "Иван Петров", Priority = TaskPriority.Low, Done = false },
        };

        db.Tasks.AddRange(tasks);

        db.ActivityEvents.AddRange(
            new ActivityEvent
            {
                TenantId = tenantId,
                Title = "Сара Дженкинс",
                Description = "Закрыта сделка «Премиум-расширение»",
                BadgeIcon = "check",
                CreatedAtUtc = now.AddMinutes(-15),
            },
            new ActivityEvent
            {
                TenantId = tenantId,
                Title = "Мария Козлова",
                Description = "Создана задача «Звонок клиенту Zenith Global»",
                BadgeIcon = "schedule",
                CreatedAtUtc = now.AddHours(-2),
            },
            new ActivityEvent
            {
                TenantId = tenantId,
                Title = "Дмитрий Волков",
                Description = "Ответ на письмо «Связаться снова»",
                BadgeIcon = "mail",
                CreatedAtUtc = now.AddHours(-5),
            },
            new ActivityEvent
            {
                TenantId = tenantId,
                Title = "Елена Морозова",
                Description = "Сделка переведена в «Переговоры»",
                BadgeIcon = "check",
                CreatedAtUtc = now.AddDays(-1),
            }
        );

        db.ContactEvents.AddRange(
            new ContactEvent
            {
                TenantId = tenantId,
                ClientId = clients[0].Id,
                Title = "Встреча по договору",
                Body = "Обсудили протоколы безопасности и сроки внедрения.",
                OccurredAtUtc = now.AddHours(-3),
            },
            new ContactEvent
            {
                TenantId = tenantId,
                ClientId = clients[1].Id,
                Title = "Отправлено КП",
                Body = "Коммерческое предложение на расширение лицензий.",
                OccurredAtUtc = now.AddDays(-1),
            },
            new ContactEvent
            {
                TenantId = tenantId,
                ClientId = clients[4].Id,
                Title = "Первый созвон",
                Body = "Выявлены требования к модулю аналитики.",
                OccurredAtUtc = now.AddDays(-2),
            }
        );

        await db.SaveChangesAsync(ct);

        return (clients.Count, deals.Count, tasks.Count);
    }

    private async Task EnsureAuditSampleAsync(int tenantId, CancellationToken ct)
    {
        if (await db.AuditLogs.AnyAsync(x => x.TenantId == tenantId, ct))
            return;

        var admin = await db.Users.SingleOrDefaultAsync(x => x.Username == "admin", ct);
        var userId = admin?.Id;
        var now = DateTime.UtcNow;
        var jsonOpts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        string J(object? o) => o is null ? "{}" : JsonSerializer.Serialize(o, jsonOpts);

        var logs = new List<AuditLog>
        {
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "clients.create",
                EntityType = nameof(Client),
                EntityId = "1",
                AfterJson = J(new { fullName = "Александр Стерлинг", company = "Zenith Global" }),
                CreatedAtUtc = now.AddDays(-7),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "deals.create",
                EntityType = nameof(Deal),
                EntityId = "5",
                AfterJson = J(new { title = "Лицензия основной платформы", stage = "Negotiation", amount = 12500m }),
                CreatedAtUtc = now.AddDays(-6),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "deals.stage",
                EntityType = nameof(Deal),
                EntityId = "5",
                BeforeJson = J(new { stage = "Lead" }),
                AfterJson = J(new { stage = "Negotiation" }),
                CreatedAtUtc = now.AddDays(-5),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "tasks.create",
                EntityType = nameof(TaskItem),
                EntityId = "1",
                AfterJson = J(new { title = "Квартальный разбор с Apex Corp", done = false }),
                CreatedAtUtc = now.AddDays(-4),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "tasks.toggle-done",
                EntityType = nameof(TaskItem),
                EntityId = "3",
                BeforeJson = J(new { done = false }),
                AfterJson = J(new { done = true }),
                CreatedAtUtc = now.AddDays(-3),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "billing.subscription.update",
                EntityType = "Subscription",
                EntityId = "1",
                BeforeJson = J(new { planCode = "free" }),
                AfterJson = J(new { planCode = "pro" }),
                CreatedAtUtc = now.AddDays(-2),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "billing.checkout",
                EntityType = "Subscription",
                EntityId = "1",
                AfterJson = J(new
                {
                    planCode = "pro",
                    planName = "PRO",
                    status = "active",
                    cardLast4 = "4242",
                    amountUsd = 50.99m,
                    receiptNumber = "RCP-DEMO-0001",
                    transactionId = "TXN-DEMO-8F2A91BC",
                    periodStartUtc = now.AddDays(-2).AddHours(1),
                    periodEndUtc = now.AddMonths(1),
                    tenantId,
                }),
                CreatedAtUtc = now.AddDays(-2).AddHours(1),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "team.update-role",
                EntityType = nameof(AppUser),
                EntityId = "2",
                BeforeJson = J(new { role = "Member" }),
                AfterJson = J(new { role = "Admin" }),
                CreatedAtUtc = now.AddDays(-1),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "profile.update",
                EntityType = nameof(AppUser),
                EntityId = userId?.ToString() ?? "1",
                BeforeJson = J(new { theme = "light", currency = "USD", language = "en" }),
                AfterJson = J(new { theme = "light", currency = "BYN", language = "ru" }),
                CreatedAtUtc = now.AddHours(-12),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "dashboard.quick-actions.update",
                EntityType = "Dashboard",
                EntityId = "quick-actions",
                AfterJson = J(new { count = 4 }),
                CreatedAtUtc = now.AddHours(-6),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "support.ticket.create",
                EntityType = "SupportTicket",
                EntityId = "1",
                AfterJson = J(new { subject = "Вопрос по тарифу PRO" }),
                CreatedAtUtc = now.AddHours(-3),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "pipelines.create",
                EntityType = nameof(SalesPipeline),
                EntityId = "1",
                AfterJson = J(new { name = "Основная", isDefault = true }),
                CreatedAtUtc = now.AddHours(-1),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "ai.advisor.query",
                EntityType = "AiAdvisor",
                EntityId = "1",
                AfterJson = J(new { prompt = "Анализ воронки и рекомендации" }),
                CreatedAtUtc = now.AddMinutes(-30),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "integrations.webhook.create",
                EntityType = "WebhookEndpoint",
                EntityId = "1",
                AfterJson = J(new { name = "CRM events", url = "https://example.com/hooks/crm" }),
                CreatedAtUtc = now.AddMinutes(-15),
            },
            new()
            {
                TenantId = tenantId,
                UserId = userId,
                Action = "deals.update",
                EntityType = nameof(Deal),
                EntityId = "9",
                BeforeJson = J(new { amount = 9000m }),
                AfterJson = J(new { amount = 9800m }),
                CreatedAtUtc = now.AddMinutes(-5),
            },
        };

        db.AuditLogs.AddRange(logs);
        await db.SaveChangesAsync(ct);
    }
}
