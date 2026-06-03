using System.Text.Json;

namespace ExpogoCrm.Api.Infrastructure;

public sealed class DashboardQuickActionDto
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Icon { get; set; } = "add";
    public int GradientIdx { get; set; }
}

public static class DashboardQuickActionsHelper
{
    private static readonly HashSet<string> AllowedIcons = new(StringComparer.OrdinalIgnoreCase)
    {
        "add", "person-add", "call", "event", "mail", "assignment",
        "check-circle", "calendar-today", "payments", "local-offer",
    };

    private static readonly HashSet<string> BuiltInIds = new(StringComparer.OrdinalIgnoreCase)
    {
        "lead", "call", "meeting",
    };

    public static IReadOnlyList<DashboardQuickActionDto> DefaultActions { get; } =
    [
        new() { Id = "lead", Title = "", Icon = "person-add", GradientIdx = 0 },
        new() { Id = "call", Title = "", Icon = "call", GradientIdx = 1 },
        new() { Id = "meeting", Title = "", Icon = "event", GradientIdx = 2 },
    ];

    public static IReadOnlyList<DashboardQuickActionDto> Resolve(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return DefaultActions;

        try
        {
            var parsed = JsonSerializer.Deserialize<List<DashboardQuickActionDto>>(json);
            if (parsed is null || parsed.Count == 0)
                return DefaultActions;
            return Validate(parsed);
        }
        catch (JsonException)
        {
            return DefaultActions;
        }
    }

    public static string Serialize(IReadOnlyList<DashboardQuickActionDto> items) =>
        JsonSerializer.Serialize(Validate(items));

    public static List<DashboardQuickActionDto> Validate(IReadOnlyList<DashboardQuickActionDto> items)
    {
        var result = new List<DashboardQuickActionDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in items.Take(20))
        {
            var id = item.Id?.Trim() ?? "";
            if (id.Length is < 1 or > 64 || !seen.Add(id))
                continue;

            var icon = item.Icon?.Trim() ?? "add";
            if (!AllowedIcons.Contains(icon))
                icon = "add";

            var gradientIdx = item.GradientIdx;
            if (gradientIdx is < 0 or > 3)
                gradientIdx = 0;

            var title = BuiltInIds.Contains(id) ? "" : (item.Title?.Trim() ?? "");
            if (!BuiltInIds.Contains(id) && title.Length is < 1 or > 64)
                continue;

            result.Add(new DashboardQuickActionDto
            {
                Id = id,
                Title = title,
                Icon = icon,
                GradientIdx = gradientIdx,
            });
        }

        return result.Count > 0 ? result : DefaultActions.ToList();
    }
}
