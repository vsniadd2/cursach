using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("seed")]
[Authorize]
public class SeedController : ControllerBase
{
    private readonly ExpogoDbContext _db;

    public SeedController(ExpogoDbContext db)
    {
        _db = db;
    }

    [HttpPost("run")]
    [Authorize(Policy = CrmPermissions.DealsWrite)]
    public async Task<ActionResult> Run(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        // Повторный запуск безопасен: если уже есть данные — ничего не делаем.
        var hasAny = await _db.Clients.AnyAsync(x => x.TenantId == tenantId, ct)
            || await _db.Deals.AnyAsync(x => x.TenantId == tenantId, ct)
            || await _db.Tasks.AnyAsync(x => x.TenantId == tenantId, ct);
        if (hasAny) return Ok(new { seeded = false });

        var c1 = new Client
        {
            TenantId = tenantId,
            FullName = "Александр Стерлинг",
            Company = "Zenith Global",
            RoleTitle = "Операционный директор",
            Phone = "+375291112233",
            WorkEmail = "a.sterling@zenith.example",
            AvatarLargeUrl =
                "https://lh3.googleusercontent.com/aida-public/AB6AXuAsDH_uxLFv0r_bsA5qqK8T409OfkAGGB0qgga3d9chEeur3iaXZvGX9Hl9nlnOKotlRzusm4LnCRfRDKwrGSUSHbpQZXCR58AF0uRHz_spnx4iyXHWQCZkyJodCH-VQT75XilKmcEChZqun9YrttC61zpSGU_o6NajPSOWsFigkOnJ3912O5rt-VCTw5APhEzYCYJRDdO-9AaN1vuZ2L7OqCgBaDesoC92GzW6ONgzafImSCF5xnofsGLwmnV0VyYYkB861afd5ow",
            AvatarSmallUrl =
                "https://lh3.googleusercontent.com/aida-public/AB6AXuB3ZB1ytWuaJcCrZkxyEZi6dbfqSzm6LrTDUj2W9l2UBKiWT5ibs_3cj88Wn9IAw73itYpgIwasE2HC2k3hyFB3hSN1JP1A4jhP9lOH_6uoponqUlLoZqQraA8mGtf32gxk7AHfCx95hgS49XJWQ7_jXugGqcc8eyXla4JQOFAjMgGR2_LSkICcCnGOZnuuWwwmkjZKz99LB3xljeG9TTuyvX2iq__oNP7yASM_Pr6rk2xPIrvFeCyBkaA7ybIlRupEnhrcxNabb98",
        };

        var c2 = new Client
        {
            TenantId = tenantId,
            FullName = "Сара Дженкинс",
            Company = "Apex Corp",
            RoleTitle = "Head of Procurement",
            Phone = "+375299998877",
            WorkEmail = "s.jenkins@apex.example",
            AvatarLargeUrl =
                "https://lh3.googleusercontent.com/aida-public/AB6AXuDGP6joUxqjBEj5afrewB6JOxfCnY4SLjln6FB2cAfV4zopXD6kEunhiKkVnHyftWuhrtBeB1nHP8Rcb8C7-hot8sQ7ACA5yBXg0BFerdXfuOU1jN0zUDjrLkWQmklt6injMDObNwt-ZO3U2Nyz0w3YuhXse2xof2SUcSNOkTXqvVedEwTqxJx0Jf_CIsT47jgdzqSqCmAoBYQDA3fukhvSx16gsZghvycgb7riHI1l3JWi3R-ySXxHyC2pmu4cfQbgHEeD-I-WR6k",
            AvatarSmallUrl =
                "https://lh3.googleusercontent.com/aida-public/AB6AXuDGP6joUxqjBEj5afrewB6JOxfCnY4SLjln6FB2cAfV4zopXD6kEunhiKkVnHyftWuhrtBeB1nHP8Rcb8C7-hot8sQ7ACA5yBXg0BFerdXfuOU1jN0zUDjrLkWQmklt6injMDObNwt-ZO3U2Nyz0w3YuhXse2xof2SUcSNOkTXqvVedEwTqxJx0Jf_CIsT47jgdzqSqCmAoBYQDA3fukhvSx16gsZghvycgb7riHI1l3JWi3R-ySXxHyC2pmu4cfQbgHEeD-I-WR6k",
        };

        _db.Clients.AddRange(c1, c2);
        await _db.SaveChangesAsync(ct);

        _db.Deals.AddRange(
            new Deal
            {
                TenantId = tenantId,
                ClientId = c1.Id,
                Title = "Лицензия основной платформы",
                Stage = DealStage.Negotiation,
                Amount = 12500m,
                ProbabilityPct = 75,
                ExpectedCloseDateUtc = DateTime.UtcNow.AddDays(30),
                DecisionMaker = "Стерлинг А.",
            },
            new Deal
            {
                TenantId = tenantId,
                ClientId = c2.Id,
                Title = "Расширение Quantum Systems",
                Stage = DealStage.Lead,
                Amount = 2500m,
                ProbabilityPct = 25,
                ExpectedCloseDateUtc = DateTime.UtcNow.AddDays(60),
            },
            new Deal
            {
                TenantId = tenantId,
                ClientId = c2.Id,
                Title = "Инфраструктура, фаза II",
                Stage = DealStage.Lead,
                Amount = 6042m,
                ProbabilityPct = 30,
                ExpectedCloseDateUtc = DateTime.UtcNow.AddDays(90),
            },
            new Deal
            {
                TenantId = tenantId,
                ClientId = c1.Id,
                Title = "Интеграция цепочки поставок",
                Stage = DealStage.Closed,
                Amount = 885m,
                ProbabilityPct = 100,
            }
        );

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        _db.Tasks.AddRange(
            new TaskItem
            {
                TenantId = tenantId,
                Date = today,
                Title = "Квартальный разбор с Acme Corp",
                Description = "Разобрать воронку и условия продления на расширение в Q4.",
                Time = new TimeOnly(9, 30),
                AssigneeName = "Сара Дженкинс",
                Priority = TaskPriority.High,
                Done = false,
            },
            new TaskItem
            {
                TenantId = tenantId,
                Date = today,
                Title = "Письма новым лидам",
                Description = "Отправить материалы 5 тёплым лидам после мероприятия.",
                Time = new TimeOnly(11, 0),
                Priority = TaskPriority.Medium,
                Done = false,
            },
            new TaskItem
            {
                TenantId = tenantId,
                Date = today,
                Title = "Черновик сводки для руководства",
                Time = new TimeOnly(8, 0),
                Priority = TaskPriority.Medium,
                Done = true,
            }
        );

        _db.ActivityEvents.AddRange(
            new ActivityEvent
            {
                TenantId = tenantId,
                Title = "Сара Дженкинс",
                Description = "Закрыта сделка «Премиум-расширение»",
                AvatarUrl = c2.AvatarSmallUrl,
                BadgeIcon = "check",
                CreatedAtUtc = DateTime.UtcNow.AddMinutes(-2),
            },
            new ActivityEvent
            {
                TenantId = tenantId,
                Title = "Дэвид Чен",
                Description = "Ответ на письмо «Связаться снова»",
                AvatarUrl =
                    "https://lh3.googleusercontent.com/aida-public/AB6AXuCLmJz5deNfGks1hPXWJtkIscr1XAG6bUe65-vYmpL4L09FILXCCQYaOWP8edTr9Uy8MYla5JOVrnvqPi1kg2hdVDMeUnCttfZkEQ1dT0mp6ls8HM5FsEDOm9HRbTEB_TrY_ntYr4bfWI66lL5Z6vjEjNDOlWDhpHYqM9NIfDw65EHtcytTutFg_vmr5-3_r-TWVxkaSeZ3FDFsPKNZvYrrwJoBDbui8GRhG33rWqF_GOYNGbR03PwLvjJTZ-i9A99X9E-zbKl1g1Y",
                BadgeIcon = "mail",
                CreatedAtUtc = DateTime.UtcNow.AddHours(-1),
            }
        );

        _db.ContactEvents.AddRange(
            new ContactEvent
            {
                TenantId = tenantId,
                ClientId = c1.Id,
                Title = "Встреча по договору",
                Body =
                    "Обсудили протоколы безопасности уровня 2. Александр запросил обновлённое коммерческое предложение по мультирегиональному расширению.",
                OccurredAtUtc = DateTime.UtcNow.AddHours(-2),
            },
            new ContactEvent
            {
                TenantId = tenantId,
                ClientId = c1.Id,
                Title = "Отправлено письмо-напоминание",
                Body = "Подтверждены технические требования к интеграции API.",
                OccurredAtUtc = DateTime.UtcNow.AddDays(-1),
            },
            new ContactEvent
            {
                TenantId = tenantId,
                ClientId = c1.Id,
                Title = "Первый созвон-знакомство",
                Body = "Выявлены основные боли в текущем ПО для логистики.",
                OccurredAtUtc = DateTime.UtcNow.AddDays(-3),
            }
        );

        await _db.SaveChangesAsync(ct);

        return Ok(new { seeded = true });
    }
}

