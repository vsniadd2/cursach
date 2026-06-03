namespace ExpogoCrm.Api.Security;

public static class CrmPermissions
{
    public const string ClientsRead = "crm.clients.read";
    public const string ClientsWrite = "crm.clients.write";
    public const string DealsRead = "crm.deals.read";
    public const string DealsWrite = "crm.deals.write";
    public const string TasksRead = "crm.tasks.read";
    public const string TasksWrite = "crm.tasks.write";
    public const string DashboardRead = "crm.dashboard.read";
    public const string TeamRead = "crm.team.read";
    public const string TeamWrite = "crm.team.write";
    public const string ReportsRead = "crm.reports.read";
    public const string SupportRead = "crm.support.read";
    public const string SupportWrite = "crm.support.write";
    public const string IntegrationsRead = "crm.integrations.read";
    public const string IntegrationsWrite = "crm.integrations.write";
    public const string BillingRead = "crm.billing.read";
    public const string BillingWrite = "crm.billing.write";
    public const string AuditRead = "crm.audit.read";
    public const string AiAdvisorRead = "crm.ai.advisor.read";
    public const string Admin = "crm.admin";

    public static readonly string[] All =
    [
        ClientsRead, ClientsWrite, DealsRead, DealsWrite, TasksRead, TasksWrite, DashboardRead,
        TeamRead, TeamWrite, ReportsRead, SupportRead, SupportWrite,
        IntegrationsRead, IntegrationsWrite, BillingRead, BillingWrite, AuditRead, AiAdvisorRead, Admin
    ];
}
