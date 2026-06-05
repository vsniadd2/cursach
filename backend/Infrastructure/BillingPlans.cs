namespace ExpogoCrm.Api.Infrastructure;

public sealed class BillingPlanDefinition
{
    public required string Code { get; init; }
    public required string Name { get; init; }
    public decimal? PriceUsdPerSeatMonthly { get; init; }
    public int SeatsLimit { get; init; }
    /// <summary>ГБ облачного диска на одного активного сотрудника.</summary>
    public int StorageGbLimit { get; init; }
    public int ContactsLimit { get; init; }
    public int FunnelsLimit { get; init; }
    public int MinSeats { get; init; } = 1;
    public bool Integrations { get; init; }
    public bool OpenApi { get; init; }
    public bool AutoTasks { get; init; }
    public bool AdvancedAnalytics { get; init; }
    public bool VipSupport { get; init; }
    public bool RoleManagement { get; init; }
}

public static class BillingPlans
{
    public static readonly IReadOnlyList<BillingPlanDefinition> All =
    [
        new()
        {
            Code = "free",
            Name = "FREE",
            PriceUsdPerSeatMonthly = null,
            SeatsLimit = 1,
            StorageGbLimit = 1,
            ContactsLimit = 500,
            FunnelsLimit = 1,
            MinSeats = 1,
            Integrations = false,
            OpenApi = false,
            AutoTasks = false,
            AdvancedAnalytics = false,
            VipSupport = false,
            RoleManagement = false,
        },
        new()
        {
            Code = "pro",
            Name = "PRO",
            PriceUsdPerSeatMonthly = 50.99m,
            SeatsLimit = 10,
            StorageGbLimit = 10,
            ContactsLimit = 2000,
            FunnelsLimit = 5,
            MinSeats = 1,
            Integrations = true,
            OpenApi = true,
            AutoTasks = true,
            AdvancedAnalytics = false,
            VipSupport = false,
            RoleManagement = false,
        },
        new()
        {
            Code = "team",
            Name = "TEAM",
            PriceUsdPerSeatMonthly = 79.99m,
            SeatsLimit = 9999,
            StorageGbLimit = 50,
            ContactsLimit = -1,
            FunnelsLimit = -1,
            MinSeats = 5,
            Integrations = true,
            OpenApi = true,
            AutoTasks = true,
            AdvancedAnalytics = true,
            VipSupport = true,
            RoleManagement = true,
        },
    ];

    public static BillingPlanDefinition? Find(string? planCode)
    {
        if (string.IsNullOrWhiteSpace(planCode)) return null;
        var normalized = planCode.Trim().ToLowerInvariant();
        if (normalized == "starter") normalized = "free";
        return All.FirstOrDefault(p => p.Code == normalized);
    }

    public static string NormalizePlanCode(string? planCode) =>
        Find(planCode)?.Code ?? "free";

    public static bool IsUnlimited(int limit) => limit < 0;

    public static int TotalStorageGb(int storageGbPerSeat, int activeSeats) =>
        storageGbPerSeat * Math.Max(1, activeSeats);

    public static long TotalStorageBytes(int storageGbPerSeat, int activeSeats) =>
        (long)TotalStorageGb(storageGbPerSeat, activeSeats) * 1024L * 1024L * 1024L;
}
