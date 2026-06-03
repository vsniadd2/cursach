using System.Text.Json;
using ZXing;
using ZXing.QrCode;
using ZXing.Rendering;

namespace ExpogoCrm.Api.Services;

internal static class PaymentReceiptQrCode
{
    public static string BuildPayload(PaymentReceiptData data) =>
        JsonSerializer.Serialize(new
        {
            app = "expogo-crm",
            v = 1,
            receipt = data.ReceiptNumber,
            transaction = data.TransactionId,
            auditId = data.AuditLogId,
            tenantId = data.TenantId,
            tenant = data.TenantSlug,
            organization = data.TenantName,
            plan = data.PlanCode,
            planName = data.PlanName,
            amountUsd = data.AmountUsd,
            currency = data.Currency,
            cardLast4 = data.CardLast4,
            paidAtUtc = data.PaidAtUtc.ToString("O"),
            periodEndUtc = data.PeriodEndUtc?.ToString("O"),
            status = data.Status,
        });

    public static string ToSvg(string payload, int sizePx = 200)
    {
        var writer = new QRCodeWriter();
        var matrix = writer.encode(payload, BarcodeFormat.QR_CODE, sizePx, sizePx);
        var renderer = new SvgRenderer { FontName = "Arial" };
        return renderer.Render(matrix, BarcodeFormat.QR_CODE, null).Content;
    }
}
