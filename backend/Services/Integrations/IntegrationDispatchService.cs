using System.Text.Json;
using ExpogoCrm.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Services.Integrations;

public interface IIntegrationDispatchService
{
    void NotifyDealClosed(int tenantId, Deal deal, Client client);
    void NotifyNewClient(int tenantId, Client client);
    void NotifyTaskOverdue(int tenantId, TaskItem task);
    void SyncTaskToCalendar(int tenantId, int taskId);
    void DeleteTaskFromCalendar(int tenantId, int taskId, string? googleEventId);
}

public sealed class IntegrationDispatchService(IServiceScopeFactory scopeFactory) : IIntegrationDispatchService
{
    public void NotifyDealClosed(int tenantId, Deal deal, Client client) =>
        EnqueueNotify(tenantId, "deal_closed",
            $"Сделка закрыта: {deal.Title}",
            $"Клиент: {client.FullName}. Сумма: {deal.Amount:N2} USD.");

    public void NotifyNewClient(int tenantId, Client client) =>
        EnqueueNotify(tenantId, "new_client",
            $"Новый клиент: {client.FullName}",
            $"Компания: {client.Company ?? "—"}.");

    public void NotifyTaskOverdue(int tenantId, TaskItem task) =>
        EnqueueNotify(tenantId, "task_overdue",
            $"Просрочена задача: {task.Title}",
            $"Срок: {task.Date:dd.MM.yyyy}.");

    public void SyncTaskToCalendar(int tenantId, int taskId) =>
        _ = RunAsync(async sp =>
        {
            var db = sp.GetRequiredService<ExpogoDbContext>();
            var gcal = sp.GetRequiredService<IGoogleCalendarIntegrationService>();
            var task = await db.Tasks.SingleOrDefaultAsync(x => x.Id == taskId && x.TenantId == tenantId);
            if (task is null) return;
            await gcal.SyncTaskAsync(tenantId, task);
        });

    public void DeleteTaskFromCalendar(int tenantId, int taskId, string? googleEventId) =>
        _ = RunAsync(async sp =>
        {
            if (string.IsNullOrWhiteSpace(googleEventId)) return;
            var gcal = sp.GetRequiredService<IGoogleCalendarIntegrationService>();
            var db = sp.GetRequiredService<ExpogoDbContext>();
            var task = await db.Tasks.AsNoTracking().SingleOrDefaultAsync(x => x.Id == taskId && x.TenantId == tenantId);
            if (task is null)
            {
                await gcal.DeleteTaskEventAsync(tenantId, new TaskItem
                {
                    TenantId = tenantId,
                    Date = DateOnly.FromDateTime(DateTime.UtcNow),
                    Title = "",
                    GoogleEventId = googleEventId,
                });
                return;
            }
            await gcal.DeleteTaskEventAsync(tenantId, task);
        });

    void EnqueueNotify(int tenantId, string eventKey, string title, string body)
    {
        _ = RunAsync(async sp =>
        {
            var db = sp.GetRequiredService<ExpogoDbContext>();
            var rows = await db.TenantIntegrations.AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.IsEnabled)
                .ToListAsync();

            foreach (var row in rows)
            {
                if (row.Provider == IntegrationProviders.Telegram)
                {
                    var cfg = IntegrationJson.Deserialize<TelegramIntegrationConfig>(row.ConfigJson) ?? new();
                    if (!ShouldNotifyTelegram(eventKey, cfg)) continue;
                    var sec = IntegrationJson.Deserialize<TelegramIntegrationSecrets>(row.SecretsJson);
                    if (sec is null || string.IsNullOrWhiteSpace(sec.BotToken)) continue;
                    var payload = JsonSerializer.Serialize(new
                    {
                        botToken = sec.BotToken,
                        chatId = cfg.ChatId,
                        text = $"<b>{title}</b>\n{body}",
                    });
                    db.IntegrationJobs.Add(new IntegrationJob
                    {
                        TenantId = tenantId,
                        JobType = "telegram",
                        PayloadJson = payload,
                        Status = IntegrationJobStatus.Pending,
                        ScheduledAtUtc = DateTime.UtcNow,
                    });
                }
                else if (row.Provider == IntegrationProviders.Email)
                {
                    var cfg = IntegrationJson.Deserialize<EmailIntegrationConfig>(row.ConfigJson) ?? new();
                    if (!ShouldNotifyEmail(eventKey, cfg)) continue;
                    var sec = IntegrationJson.Deserialize<EmailIntegrationSecrets>(row.SecretsJson);
                    if (sec is null || string.IsNullOrWhiteSpace(sec.SmtpPassword)) continue;
                    var payload = JsonSerializer.Serialize(new
                    {
                        config = cfg,
                        password = sec.SmtpPassword,
                        subject = title,
                        body,
                    });
                    db.IntegrationJobs.Add(new IntegrationJob
                    {
                        TenantId = tenantId,
                        JobType = "email",
                        PayloadJson = payload,
                        Status = IntegrationJobStatus.Pending,
                        ScheduledAtUtc = DateTime.UtcNow,
                    });
                }
            }

            await db.SaveChangesAsync();
        });
    }

    static bool ShouldNotifyTelegram(string eventKey, TelegramIntegrationConfig cfg) => eventKey switch
    {
        "deal_closed" => cfg.NotifyDealClosed,
        "task_overdue" => cfg.NotifyTaskOverdue,
        "new_client" => cfg.NotifyNewClient,
        _ => true,
    };

    static bool ShouldNotifyEmail(string eventKey, EmailIntegrationConfig cfg) => eventKey switch
    {
        "deal_closed" => cfg.NotifyDealClosed,
        "task_overdue" => cfg.NotifyTaskOverdue,
        "new_client" => cfg.NotifyNewClient,
        _ => true,
    };

    async Task RunAsync(Func<IServiceProvider, Task> action)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            await action(scope.ServiceProvider);
        }
        catch
        {
            // fire-and-forget: do not break CRM API
        }
    }
}

public interface IIntegrationTestService
{
    Task TestProviderAsync(int tenantId, string provider, string? testEmail, CancellationToken ct = default);
}

public sealed class IntegrationTestService(
    ITelegramIntegrationClient telegram,
    ISmtpEmailIntegrationClient smtp,
    IGoogleCalendarIntegrationService gcal,
    ExpogoDbContext db) : IIntegrationTestService
{
    public async Task TestProviderAsync(int tenantId, string provider, string? testEmail, CancellationToken ct = default)
    {
        var row = await db.TenantIntegrations.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Provider == provider, ct)
            ?? throw new InvalidOperationException("Сначала сохраните настройки интеграции.");

        switch (provider)
        {
            case IntegrationProviders.Telegram:
                var tgCfg = IntegrationJson.Deserialize<TelegramIntegrationConfig>(row.ConfigJson) ?? new();
                var tgSec = IntegrationJson.Deserialize<TelegramIntegrationSecrets>(row.SecretsJson) ?? new();
                await telegram.SendAsync(
                    tgSec.BotToken,
                    tgCfg.ChatId,
                    "Expogo CRM: тестовое уведомление из раздела «Интеграции».",
                    ct);
                break;
            case IntegrationProviders.Email:
                var emCfg = IntegrationJson.Deserialize<EmailIntegrationConfig>(row.ConfigJson) ?? new();
                var emSec = IntegrationJson.Deserialize<EmailIntegrationSecrets>(row.SecretsJson) ?? new();
                var to = string.IsNullOrWhiteSpace(testEmail) ? emCfg.FromEmail : testEmail;
                if (string.IsNullOrWhiteSpace(to))
                    throw new InvalidOperationException("Укажите email для теста или From Email.");
                await smtp.SendAsync(
                    emCfg,
                    emSec.SmtpPassword,
                    to,
                    "Expogo CRM — тест интеграции",
                    "Это тестовое письмо из раздела «Интеграции».",
                    ct);
                break;
            case IntegrationProviders.GoogleCalendar:
                await gcal.TestAsync(tenantId, ct);
                break;
            default:
                throw new ArgumentException("Unknown provider");
        }
    }
}
