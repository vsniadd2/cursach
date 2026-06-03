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
            PdfBilingualLabels.Receipt.BankCard,
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
            ? PdfBilingualLabels.Receipt.TeamBillingCycle
            : PdfBilingualLabels.Receipt.MonthlySubscription;

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
                            brand.Item().Text(PdfBilingualLabels.Receipt.SubscriptionReceipt).FontSize(12).FontColor(Colors.Grey.Darken3);
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
                                .Text(PdfBilingualLabels.Receipt.QrVerification).FontSize(7).FontColor(Colors.Grey.Darken2);
                            qrCol.Item().AlignRight()
                                .Text(d.ReceiptNumber).FontSize(7).Bold();
                        });
                    });

                    root.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                    root.Item().Row(titleRow =>
                    {
                        titleRow.RelativeItem().Text(PdfBilingualLabels.Receipt.PaymentDocument).Bold().FontSize(14);
                        titleRow.ConstantItem(180).AlignRight().Text(PdfBilingualLabels.Receipt.IssuedAt(paidAt)).FontSize(8);
                    });

                    root.Item().Background(Colors.Grey.Lighten4).Padding(12).Column(box =>
                    {
                        box.Spacing(6);
                        TwoCol(box, PdfBilingualLabels.Receipt.ReceiptNumber, d.ReceiptNumber);
                        TwoCol(box, PdfBilingualLabels.Receipt.TransactionId, d.TransactionId);
                        TwoCol(box, PdfBilingualLabels.Receipt.AuditLogEntry, $"#{d.AuditLogId}");
                        TwoCol(box, PdfBilingualLabels.Receipt.Organization, $"{d.TenantName} (ID {d.TenantId})");
                        TwoCol(box, PdfBilingualLabels.Receipt.OrganizationCode, d.TenantSlug);
                        TwoCol(box, PdfBilingualLabels.Receipt.Payer, d.PayerName ?? "—");
                        TwoCol(box, PdfBilingualLabels.Receipt.PayerEmail, d.PayerEmail ?? "—");
                        TwoCol(box, PdfBilingualLabels.Receipt.PaymentMethod, d.PaymentMethod);
                        TwoCol(box, PdfBilingualLabels.Receipt.Card, card);
                        TwoCol(box, PdfBilingualLabels.Receipt.PaymentStatus, StatusLabel(d.Status));
                        TwoCol(box, PdfBilingualLabels.Receipt.PreviousPlan, prevPlan);
                        TwoCol(box, PdfBilingualLabels.Receipt.NewPlan, $"{d.PlanName} ({d.PlanCode.ToUpperInvariant()})");
                        TwoCol(box, PdfBilingualLabels.Receipt.SubscriptionPeriod, $"{periodStart} — {periodEnd}");
                        TwoCol(box, PdfBilingualLabels.Receipt.BillingCycle, billingCycle);
                    });

                    root.Item().Text(PdfBilingualLabels.Receipt.PaymentBreakdown).Bold().FontSize(11);
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
                                .Text(PdfBilingualLabels.Receipt.Description).Bold().FontSize(9);
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(8)
                                .Text(PdfBilingualLabels.Receipt.Period).Bold().FontSize(9);
                            header.Cell().Background(Colors.Grey.Lighten3).Padding(8).AlignRight()
                                .Text(PdfBilingualLabels.Receipt.Amount).Bold().FontSize(9);
                        });

                        var periodLabel = d.PeriodEndUtc is DateTime end
                            ? PdfBilingualLabels.Receipt.Until(end.ToString("dd.MM.yyyy"))
                            : PdfBilingualLabels.Receipt.OneMonth;

                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8)
                            .Text(PdfBilingualLabels.Receipt.SubscriptionLine(d.PlanName));
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8)
                            .Text(periodLabel);
                        table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(8).AlignRight()
                            .Text(amount).Bold();

                        table.Cell().ColumnSpan(2).Background(Colors.Grey.Lighten4).Padding(8)
                            .AlignRight().Text(PdfBilingualLabels.Receipt.TotalDue).Bold();
                        table.Cell().Background(Colors.Grey.Lighten4).Padding(8).AlignRight()
                            .Text(amount).Bold().FontSize(12);
                    });

                    root.Item().Text(PdfBilingualLabels.Receipt.PlanIncludes).Bold().FontSize(11);
                    root.Item().Column(features =>
                    {
                        features.Spacing(4);
                        Feature(features, PdfBilingualLabels.Receipt.TeamSeats, LimitLabel(d.SeatsLimit, "мест", "seats"));
                        Feature(features, PdfBilingualLabels.Receipt.Contacts, LimitLabel(d.ContactsLimit, "контактов", "contacts"));
                        Feature(features, PdfBilingualLabels.Receipt.SalesFunnels, LimitLabel(d.FunnelsLimit, "воронок", "funnels"));
                        Feature(features, PdfBilingualLabels.Receipt.CloudStorage, PdfBilingualLabels.Receipt.GbPerUser(d.StorageGbLimit));
                        Feature(features, PdfBilingualLabels.Receipt.IntegrationsApi, d.Integrations && d.OpenApi ? PdfBilingualLabels.Receipt.Yes : PdfBilingualLabels.Receipt.No);
                        Feature(features, PdfBilingualLabels.Receipt.VipSupport, d.VipSupport ? PdfBilingualLabels.Receipt.Yes : PdfBilingualLabels.Receipt.No);
                    });

                    root.Item().LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                    root.Item().Row(footer =>
                    {
                        footer.RelativeItem().Column(left =>
                        {
                            left.Item().Text(PdfBilingualLabels.Receipt.PaymentSuccess).FontSize(9);
                            left.Item().Text(PdfBilingualLabels.Receipt.VatNote(d.Currency)).FontSize(8)
                                .FontColor(Colors.Grey.Darken2);
                            left.Item().PaddingTop(4).Text(SupportLine).FontSize(8).FontColor(Colors.Grey.Darken2);
                        });
                        footer.ConstantItem(140).AlignRight().Column(right =>
                        {
                            right.Item().Text(PdfBilingualLabels.Receipt.ServiceSignature).FontSize(8).FontColor(Colors.Grey.Darken2);
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
        status.Equals("active", StringComparison.OrdinalIgnoreCase)
            ? PdfBilingualLabels.Receipt.PaidActive
            : status;

    private static string LimitLabel(int limit, string unitRu, string unitEn) =>
        BillingPlans.IsUnlimited(limit)
            ? PdfBilingualLabels.Receipt.Unlimited
            : PdfBilingualLabels.Receipt.UpTo(limit, unitRu, unitEn);

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
