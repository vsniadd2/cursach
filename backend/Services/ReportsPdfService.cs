using System.Globalization;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace ExpogoCrm.Api.Services;

public interface IReportsPdfService
{
    byte[] BuildPdf(ReportAnalytics data);
}

public sealed class ReportsPdfService : IReportsPdfService
{
    private static bool _fontReady;
    private static readonly object FontLock = new();

    private static readonly string StageLead = "#3B82F6";
    private static readonly string StageNegotiation = "#F97316";
    private static readonly string StageClosed = "#16A34A";

    static ReportsPdfService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        QuestPDF.Settings.UseEnvironmentFonts = false;
    }

    public byte[] BuildPdf(ReportAnalytics d)
    {
        EnsureFont();
        var generated = d.GeneratedAtUtc.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture);

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
                    root.Spacing(16);

                    root.Item().Column(h =>
                    {
                        h.Item().Text("Expogo CRM").Bold().FontSize(20);
                        h.Item().Text("Отчёт по продажам").FontSize(13).FontColor(Colors.Grey.Darken2);
                        h.Item().Text($"{d.TenantName} · сформирован {generated} UTC").FontSize(9)
                            .FontColor(Colors.Grey.Darken2);
                    });

                    root.Item().Text("Ключевые показатели").Bold().FontSize(12);
                    root.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn();
                            c.RelativeColumn();
                        });
                        KpiCell(table, "Выручка за месяц", $"${d.MonthRevenueUsd:N2}");
                        KpiCell(table, "Конверсия в закрытие", $"{d.ConversionPct:N1}%");
                        KpiCell(table, "Сделок всего", d.TotalDeals.ToString());
                        KpiCell(table, "Закрытых сделок", d.ClosedDeals.ToString());
                        if (d.QuarterRevenueUsd is decimal q)
                            KpiCell(table, "Выручка за квартал", $"${q:N2}");
                        KpiCell(table, "Просроченные задачи", d.OverdueTasks.ToString());
                    });

                    root.Item().PaddingTop(8).Text("Воронка сделок").Bold().FontSize(12);
                    root.Item().Element(c => DrawStageBars(c, d));

                    root.Item().PaddingTop(8).Text("Выручка по месяцам (закрытые сделки)").Bold().FontSize(12);
                    root.Item().Element(c => DrawMonthlyBars(c, d.MonthlyRevenue));

                    root.Item().PaddingTop(8).Text("Конверсия воронки").Bold().FontSize(12);
                    root.Item().Element(c => DrawConversionBar(c, d));
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(8).FontColor(Colors.Grey.Darken2));
                    t.Span("Expogo CRM · ");
                    t.CurrentPageNumber();
                    t.Span(" / ");
                    t.TotalPages();
                });
            });
        }).GeneratePdf();
    }

    private static void KpiCell(TableDescriptor table, string label, string value)
    {
        table.Cell().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(10).Column(col =>
        {
            col.Item().Text(label).FontSize(9).FontColor(Colors.Grey.Darken2);
            col.Item().Text(value).Bold().FontSize(14);
        });
    }

    private static void DrawStageBars(IContainer container, ReportAnalytics d)
    {
        var total = d.StageSlices.Sum(x => x.Count);
        if (total == 0) total = 1;

        var colors = new[] { StageLead, StageNegotiation, StageClosed };

        container.Column(col =>
        {
            col.Spacing(8);
            for (var i = 0; i < d.StageSlices.Count; i++)
            {
                var slice = d.StageSlices[i];
                var pct = Math.Round((decimal)slice.Count / total * 100m, 1);
                var color = i < colors.Length ? colors[i] : "#9CA3AF";

                col.Item().Row(row =>
                {
                    row.ConstantItem(90).Text(slice.Label).FontSize(9);
                    row.RelativeItem().Height(18).Row(bar =>
                    {
                        bar.RelativeItem(Math.Max(1, slice.Count)).Background(color);
                        var rest = total - slice.Count;
                        if (rest > 0)
                            bar.RelativeItem(rest);
                    });
                    row.ConstantItem(72).AlignRight().Text($"{slice.Count} ({pct}%)").FontSize(9);
                });
            }
        });
    }

    private static void DrawMonthlyBars(IContainer container, IReadOnlyList<ReportMonthRevenue> months)
    {
        var max = months.Max(x => x.AmountUsd);
        if (max <= 0) max = 1;

        container.Height(140).Row(row =>
        {
            row.Spacing(6);
            foreach (var m in months)
            {
                var h = Math.Max(8f, (float)(m.AmountUsd / max) * 110f);
                row.RelativeItem().Column(col =>
                {
                    col.Item().Height(110).AlignBottom().Row(inner =>
                    {
                        inner.RelativeItem().Height(h).Background(Colors.Blue.Medium);
                    });
                    col.Item().PaddingTop(4).AlignCenter().Text(m.Label).FontSize(7);
                    col.Item().AlignCenter().Text($"${m.AmountUsd:N0}").FontSize(7).Bold();
                });
            }
        });
    }

    private static void DrawConversionBar(IContainer container, ReportAnalytics d)
    {
        var open = Math.Max(0, d.TotalDeals - d.ClosedDeals);
        var total = Math.Max(1, d.TotalDeals);
        var closedPct = (float)d.ClosedDeals / total * 100f;
        var openPct = 100f - closedPct;

        container.Column(col =>
        {
            col.Spacing(6);
            col.Item().Height(22).Row(row =>
            {
                if (closedPct > 0)
                    row.RelativeItem(closedPct).Background(StageClosed);
                if (openPct > 0)
                    row.RelativeItem(openPct).Background(Colors.Grey.Lighten2);
            });
            col.Item().Row(legend =>
            {
                legend.RelativeItem().Text($"Закрыто: {d.ClosedDeals} ({d.ConversionPct}%)").FontSize(9);
                legend.RelativeItem().AlignRight().Text($"В работе: {open}").FontSize(9);
            });
        });
    }

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
}
