using System.Globalization;
using System.Text.Json;
using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace ExpogoCrm.Api.Services;

public sealed record PaymentReceiptData(
    long AuditLogId,
    int TenantId,
    string TenantSlug,
    string ReceiptNumber,
    string TransactionId,
    string TenantName,
    string? PayerName,
    string? PayerEmail,
    string PlanCode,
    string PlanName,
    decimal? AmountUsd,
    string Currency,
    string? CardLast4,
    string PaymentMethod,
    string Status,
    string? PreviousPlanCode,
    DateTime PaidAtUtc,
    DateTime? PeriodStartUtc,
    DateTime? PeriodEndUtc,
    int SeatsLimit,
    int ContactsLimit,
    int FunnelsLimit,
    int StorageGbLimit,
    bool Integrations,
    bool OpenApi,
    bool VipSupport);

public interface IPaymentReceiptPdfService
{
    byte[] BuildPdf(PaymentReceiptData data);
    PaymentReceiptData? BuildFromAudit(AuditLog log, Tenant tenant, AppUser? payer, BillingSubscription? subscription);
}

public sealed class PaymentReceiptPdfService : IPaymentReceiptPdfService
{
    private const string MerchantName = "Expogo CRM";
    private const string MerchantLegal = "ООО «Экспого Софт» · УНП 123456789 · г. Минск";
    private const string SupportLine = "support@expogo.example · +375 (17) 000-00-00";

    private static bool _fontReady;
    private static readonly object FontLock = new();

    static PaymentReceiptPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        QuestPDF.Settings.UseEnvironmentFonts = false;
    }

    public PaymentReceiptData? BuildFromAudit(
        AuditLog log,
        Tenant tenant,
        AppUser? payer,
        BillingSubscription? subscription)
    {
        if (!string.Equals(log.Action, "billing.checkout", StringComparison.OrdinalIgnoreCase))
            return null;

        var after = ParseJson(log.AfterJson);
        if (after is null) return null;

        var planCode = GetString(after, "planCode", "PlanCode") ?? tenant.PlanCode;
        var plan = BillingPlans.Find(planCode);
        if (plan is null) return null;

        var before = ParseJson(log.BeforeJson);
        var previousPlan = GetString(before, "PlanCode", "planCode");

        var receiptNumber = GetString(after, "receiptNumber", "ReceiptNumber")
            ?? $"RCP-{log.TenantId}-{log.Id:D6}";
        var transactionId = GetString(after, "transactionId", "TransactionId")
            ?? $"TXN-{log.TenantId}-A{log.Id:D6}";
        var amount = GetDecimal(after, "amountUsd", "AmountUsd") ?? plan.PriceUsdPerSeatMonthly;
        var periodEnd = GetDateTime(after, "periodEndUtc", "PeriodEndUtc", "CurrentPeriodEndUtc")
            ?? subscription?.CurrentPeriodEndUtc;
        var periodStart = GetDateTime(after, "periodStartUtc", "PeriodStartUtc", "CurrentPeriodStartUtc")
            ?? subscription?.CurrentPeriodStartUtc;

        return new PaymentReceiptData(
            log.Id,
            tenant.Id,
            tenant.Slug,
            receiptNumber,
            transactionId,
            tenant.Name,
            payer?.FullName ?? payer?.Username,
            payer?.Email,
            plan.Code,
            GetString(after, "planName", "PlanName") ?? plan.Name,
            amount,
            "USD",
            GetString(after, "cardLast4", "CardLast4"),
            "Банковская карта",
            GetString(after, "status", "Status") ?? subscription?.Status ?? "active",
            previousPlan,
            log.CreatedAtUtc,
            periodStart,
            periodEnd,
            plan.SeatsLimit,
            plan.ContactsLimit,
            plan.FunnelsLimit,
            plan.StorageGbLimit,
            plan.Integrations,
            plan.OpenApi,
            plan.VipSupport);
    }

    public byte[] BuildPdf(PaymentReceiptData d)
    {
        EnsureFont();
        var qrPayload = PaymentReceiptQrCode.BuildPayload(d);
        var qrSvg = PaymentReceiptQrCode.ToSvg(qrPayload, 220);

        var paidAt = FormatUtc(d.PaidAtUtc);
        var periodStart = d.PeriodStartUtc is DateTime ps ? FormatUtc(ps) : "—";
        var periodEnd = d.PeriodEndUtc is DateTime pe ? FormatUtc(pe) : "—";
        var amount = FormatMoney(d.AmountUsd, d.Currency);
        var card = string.IsNullOrWhiteSpace(d.CardLast4) ? "—" : $"**** **** **** {d.CardLast4}";
        var prevPlan = string.IsNullOrWhiteSpace(d.PreviousPlanCode) ? "—" : d.PreviousPlanCode.ToUpperInvariant();
        var billingCycle = d.PlanCode.Equals("team", StringComparison.OrdinalIgnoreCase)
            ? "Ежемесячно · оплата за место (от 5 участников)"
            : "Ежемесячная подписка";

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor(Colors.Black).FontFamily("Noto Sans"));

                page.Content().Column(root =>
                {
                    root.Spacing(14);

                    root.Item().Row(header =>
                    {
                        header.RelativeItem().Column(brand =>
                        {
                            brand.Item().Text(MerchantName).Bold().FontSize(22).FontColor(Colors.Black);
                            brand.Item().Text("Чек об оплате подписки").FontSize(12).FontColor(Colors.Grey.Darken3);
                            brand.Item().PaddingTop(4).Text(MerchantLegal).FontSize(8).FontColor(Colors.Grey.Darken2);
                        });

                        header.ConstantItem(118).Column(qrCol =>
                        {
                            qrCol.Item()
                                .AlignRight()
                                .Width(108)
                                .Height(108)
                                .Svg(_ => qrSvg);
                            qrCol.Item().AlignRight().PaddingTop(4)
                                .Text("QR проверки").FontSize(7).FontColor(Colors.Grey.Darken2);
                            qrCol.Item().AlignRight()
                                .Text(d.ReceiptNumber).FontSize(7).Bold();
                        });
                    });

                    root.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                    root.Item().Row(titleRow =>
                    {
                        titleRow.RelativeItem().Text("ПЛАТЁЖНЫЙ ДОКУМЕНТ").Bold().FontSize(14);
                        titleRow.ConstantItem(180).AlignRight().Text($"Выпущен: {paidAt} UTC").FontSize(8);
                    });

                    root.Item().Background(Colors.Grey.Lighten4).Padding(12).Column(box =>
                    {
                        box.Spacing(6);
                        TwoCol(box, "Номер чека", d.ReceiptNumber);
                        TwoCol(box, "ID транзакции", d.TransactionId);
                        TwoCol(box, "Запись аудита", $"#{d.AuditLogId}");
                        TwoCol(box, "Организация", $"{d.TenantName} (ID {d.TenantId})");
                        TwoCol(box, "Код организации", d.TenantSlug);
                        TwoCol(box, "Плательщик", d.PayerName ?? "—");
                        TwoCol(box, "E-mail плательщика", d.PayerEmail ?? "—");
                        TwoCol(box, "Способ оплаты", d.PaymentMethod);
                        TwoCol(box, "Карта", card);
                        TwoCol(box, "Статус платежа", StatusLabel(d.Status));
                        TwoCol(box, "Предыдущий тариф", prevPlan);
                        TwoCol(box, "Новый тариф", $"{d.PlanName} ({d.PlanCode.ToUpperInvariant()})");
                        TwoCol(box, "Период подписки", $"{periodStart} — {periodEnd}");
                        TwoCol(box, "Тип списания", billingCycle);
                    });

                    root.Item().Text("Состав платежа").Bold().FontSize(11);
                    root.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(5);
                            columns.RelativeColumn(2);
                            columns.ConstantColumn(90);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(8)
                                .Text("Наименование").Bold().FontSize(9);
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(8)
                                .Text("Период").Bold().FontSize(9);
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(8).AlignRight()
                                .Text("Сумма").Bold().FontSize(9);
                        });

                        var periodLabel = d.PeriodEndUtc is DateTime end
                            ? $"до {end:dd.MM.yyyy}"
                            : "1 мес.";

                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8)
                            .Text($"Подписка {d.PlanName} — CRM Expogo");
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8)
                            .Text(periodLabel);
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8).AlignRight()
                            .Text(amount).Bold();

                        table.Cell().ColumnSpan(2).Background(Colors.Grey.Lighten4).Padding(8)
                            .AlignRight().Text("ИТОГО К ОПЛАТЕ").Bold();
                        table.Cell().Background(Colors.Grey.Lighten4).Padding(8).AlignRight()
                            .Text(amount).Bold().FontSize(12);
                    });

                    root.Item().Text("Включено в тариф").Bold().FontSize(11);
                    root.Item().Column(features =>
                    {
                        features.Spacing(4);
                        Feature(features, "Участники команды", LimitLabel(d.SeatsLimit, "мест"));
                        Feature(features, "Контакты", LimitLabel(d.ContactsLimit, "контактов"));
                        Feature(features, "Воронки продаж", LimitLabel(d.FunnelsLimit, "воронок"));
                        Feature(features, "Облачное хранилище", $"{d.StorageGbLimit} ГБ на пользователя");
                        Feature(features, "Интеграции и API", d.Integrations && d.OpenApi ? "Да" : "Нет");
                        Feature(features, "VIP-поддержка 24/7", d.VipSupport ? "Да" : "Нет");
                    });

                    root.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                    root.Item().Row(footer =>
                    {
                        footer.RelativeItem().Column(left =>
                        {
                            left.Item().Text("Платёж успешно проведён. Подписка активирована.").FontSize(9);
                            left.Item().Text($"НДС: не облагается (цифровая услуга) · Валюта расчёта: {d.Currency}").FontSize(8)
                                .FontColor(Colors.Grey.Darken2);
                            left.Item().PaddingTop(4).Text(SupportLine).FontSize(8).FontColor(Colors.Grey.Darken2);
                        });
                        footer.ConstantItem(140).AlignRight().Column(right =>
                        {
                            right.Item().Text("Подпись сервиса").FontSize(8).FontColor(Colors.Grey.Darken2);
                            right.Item().Text("EXPogo · Billing").Bold().FontSize(10);
                        });
                    });
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(8).FontColor(Colors.Grey.Darken2));
                    t.Span($"{MerchantName} · {d.ReceiptNumber} · ");
                    t.CurrentPageNumber();
                    t.Span(" / ");
                    t.TotalPages();
                });
            });
        }).GeneratePdf();
    }

    private static void TwoCol(ColumnDescriptor col, string label, string value)
    {
        col.Item().Row(row =>
        {
            row.ConstantItem(155).Text(label).SemiBold().FontSize(9).FontColor(Colors.Grey.Darken3);
            row.RelativeItem().Text(value).FontSize(9).FontColor(Colors.Black);
        });
    }

    private static void Feature(ColumnDescriptor col, string label, string value)
    {
        col.Item().Row(row =>
        {
            row.ConstantItem(180).Text($"• {label}");
            row.RelativeItem().Text(value).SemiBold();
        });
    }

    private static string FormatUtc(DateTime dt) =>
        dt.ToUniversalTime().ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture);

    private static string FormatMoney(decimal? amount, string currency)
    {
        if (amount is null) return "—";
        return $"{currency} {amount.Value.ToString("N2", CultureInfo.InvariantCulture)}";
    }

    private static string StatusLabel(string status) =>
        status.Equals("active", StringComparison.OrdinalIgnoreCase) ? "Оплачено · активна" : status;

    private static string LimitLabel(int limit, string unit) =>
        BillingPlans.IsUnlimited(limit) ? "Без ограничений" : $"До {limit} {unit}";

    private static void EnsureFont()
    {
        if (_fontReady) return;
        lock (FontLock)
        {
            if (_fontReady) return;
            var path = Path.Combine(AppContext.BaseDirectory, "Assets", "NotoSans-Regular.ttf");
            if (!File.Exists(path))
                throw new InvalidOperationException($"Шрифт для PDF не найден: {path}");
            using var stream = File.OpenRead(path);
            FontManager.RegisterFontWithCustomName("Noto Sans", stream);
            _fontReady = true;
        }
    }

    private static Dictionary<string, JsonElement>? ParseJson(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(raw);
        }
        catch
        {
            return null;
        }
    }

    private static string? GetString(Dictionary<string, JsonElement>? json, params string[] keys)
    {
        if (json is null) return null;
        foreach (var key in keys)
        {
            if (!json.TryGetValue(key, out var el)) continue;
            if (el.ValueKind == JsonValueKind.String)
            {
                var s = el.GetString();
                if (!string.IsNullOrWhiteSpace(s)) return s;
            }
            else if (el.ValueKind is JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False)
                return el.ToString();
        }
        return null;
    }

    private static decimal? GetDecimal(Dictionary<string, JsonElement>? json, params string[] keys)
    {
        if (json is null) return null;
        foreach (var key in keys)
        {
            if (!json.TryGetValue(key, out var el)) continue;
            if (el.TryGetDecimal(out var d)) return d;
            if (el.ValueKind == JsonValueKind.Number && el.TryGetDouble(out var dbl)) return (decimal)dbl;
        }
        return null;
    }

    private static DateTime? GetDateTime(Dictionary<string, JsonElement>? json, params string[] keys)
    {
        if (json is null) return null;
        foreach (var key in keys)
        {
            if (!json.TryGetValue(key, out var el)) continue;
            if (el.ValueKind == JsonValueKind.String
                && DateTime.TryParse(el.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dt))
                return dt;
        }
        return null;
    }
}
