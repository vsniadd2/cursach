namespace ExpogoCrm.Api.Infrastructure;

/// <summary>Русский/English подписи для PDF отчётов и чеков.</summary>
public static class PdfBilingualLabels
{
    public static string RuEn(string ru, string en) => $"{ru}/{en}";

    public static class Report
    {
        public static string Title => RuEn("Отчёт по продажам", "Sales Report");
        public static string GeneratedAt(string tenant, string utc) =>
            $"{tenant} · {RuEn("сформирован", "generated")} {utc} UTC";
        public static string KeyMetrics => RuEn("Ключевые показатели", "Key metrics");
        public static string MonthRevenue => RuEn("Выручка за месяц", "Monthly revenue");
        public static string CloseConversion => RuEn("Конверсия в закрытие", "Close conversion");
        public static string TotalDeals => RuEn("Сделок всего", "Total deals");
        public static string ClosedDeals => RuEn("Закрытых сделок", "Closed deals");
        public static string QuarterRevenue => RuEn("Выручка за квартал", "Quarterly revenue");
        public static string OverdueTasks => RuEn("Просроченные задачи", "Overdue tasks");
        public static string DealPipeline => RuEn("Воронка сделок", "Deal pipeline");
        public static string MonthlyRevenue =>
            RuEn("Выручка по месяцам (закрытые сделки)", "Monthly revenue (closed deals)");
        public static string FunnelConversion => RuEn("Конверсия воронки", "Pipeline conversion");
        public static string ClosedLegend(int count, decimal pct) =>
            $"{RuEn("Закрыто", "Closed")}: {count} ({pct}%)";
        public static string InProgressLegend(int count) =>
            $"{RuEn("В работе", "In progress")}: {count}";

        public static string StageLead => RuEn("Лиды", "Leads");
        public static string StageNegotiation => RuEn("Переговоры", "Negotiation");
        public static string StageClosed => RuEn("Закрыты", "Closed");
    }

    public static class Receipt
    {
        public static string SubscriptionReceipt => RuEn("Чек об оплате подписки", "Subscription payment receipt");
        public static string QrVerification => RuEn("QR проверки", "Verification QR");
        public static string PaymentDocument => RuEn("ПЛАТЁЖНЫЙ ДОКУМЕНТ", "PAYMENT DOCUMENT");
        public static string IssuedAt(string utc) => $"{RuEn("Выпущен", "Issued")}: {utc} UTC";
        public static string ReceiptNumber => RuEn("Номер чека", "Receipt number");
        public static string TransactionId => RuEn("ID транзакции", "Transaction ID");
        public static string AuditLogEntry => RuEn("Запись аудита", "Audit log entry");
        public static string Organization => RuEn("Организация", "Organization");
        public static string OrganizationCode => RuEn("Код организации", "Organization code");
        public static string Payer => RuEn("Плательщик", "Payer");
        public static string PayerEmail => RuEn("E-mail плательщика", "Payer e-mail");
        public static string PaymentMethod => RuEn("Способ оплаты", "Payment method");
        public static string Card => RuEn("Карта", "Card");
        public static string PaymentStatus => RuEn("Статус платежа", "Payment status");
        public static string PreviousPlan => RuEn("Предыдущий тариф", "Previous plan");
        public static string NewPlan => RuEn("Новый тариф", "New plan");
        public static string SubscriptionPeriod => RuEn("Период подписки", "Subscription period");
        public static string BillingCycle => RuEn("Тип списания", "Billing cycle");
        public static string PaymentBreakdown => RuEn("Состав платежа", "Payment breakdown");
        public static string Description => RuEn("Наименование", "Description");
        public static string Period => RuEn("Период", "Period");
        public static string Amount => RuEn("Сумма", "Amount");
        public static string TotalDue => RuEn("ИТОГО К ОПЛАТЕ", "TOTAL DUE");
        public static string PlanIncludes => RuEn("Включено в тариф", "Plan includes");
        public static string TeamSeats => RuEn("Участники команды", "Team seats");
        public static string Contacts => RuEn("Контакты", "Contacts");
        public static string SalesFunnels => RuEn("Воронки продаж", "Sales funnels");
        public static string CloudStorage => RuEn("Облачное хранилище", "Cloud storage");
        public static string IntegrationsApi => RuEn("Интеграции и API", "Integrations & API");
        public static string VipSupport => RuEn("VIP-поддержка 24/7", "VIP support 24/7");
        public static string Yes => RuEn("Да", "Yes");
        public static string No => RuEn("Нет", "No");
        public static string PaymentSuccess =>
            RuEn("Платёж успешно проведён. Подписка активирована.", "Payment successful. Subscription activated.");
        public static string VatNote(string currency) =>
            $"{RuEn("НДС: не облагается (цифровая услуга)", "VAT: not applicable (digital service)")} · {RuEn("Валюта расчёта", "Settlement currency")}: {currency}";
        public static string ServiceSignature => RuEn("Подпись сервиса", "Service signature");
        public static string BankCard => RuEn("Банковская карта", "Bank card");
        public static string PaidActive => RuEn("Оплачено · активна", "Paid · active");
        public static string Unlimited => RuEn("Без ограничений", "Unlimited");
        public static string UpTo(int limit, string unitRu, string unitEn) =>
            $"{RuEn("До", "Up to")} {limit} {RuEn(unitRu, unitEn)}";
        public static string GbPerUser(int gb) => $"{gb} {RuEn("ГБ на пользователя", "GB per user")}";
        public static string SubscriptionLine(string planName) =>
            $"{RuEn("Подписка", "Subscription")} {planName} — CRM Expogo";
        public static string OneMonth => RuEn("1 мес.", "1 mo.");
        public static string Until(string date) => $"{RuEn("до", "until")} {date}";
        public static string TeamBillingCycle =>
            RuEn("Ежемесячно · оплата за место (от 5 участников)", "Monthly · per-seat billing (from 5 seats)");
        public static string MonthlySubscription =>
            RuEn("Ежемесячная подписка", "Monthly subscription");
    }
}
