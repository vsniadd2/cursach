namespace ExpogoCrm.Api.Infrastructure;

public static class BillingLimitCodes
{
    public const string Contacts = "billing.limit.contacts";
    public const string Pipelines = "billing.limit.pipelines";
    public const string Seats = "billing.limit.seats";
    public const string Integrations = "billing.limit.integrations";
    public const string AiAdvisor = "billing.limit.ai";
    public const string TeamRoles = "billing.limit.teamRoles";
    public const string Reports = "billing.limit.reports";
    public const string TeamMinSeats = "billing.limit.teamMinSeats";
    public const string DowngradeUsage = "billing.limit.downgradeUsage";
    public const string Storage = "billing.limit.storage";
}

public sealed class BillingCheckResult
{
    public bool Allowed { get; init; }
    public string? Code { get; init; }
    public string? Message { get; init; }

    public static BillingCheckResult Ok() => new() { Allowed = true };

    public static BillingCheckResult Deny(string code, string message) =>
        new() { Allowed = false, Code = code, Message = message };
}
