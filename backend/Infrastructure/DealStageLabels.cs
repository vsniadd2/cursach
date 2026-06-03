using ExpogoCrm.Api.Data;

namespace ExpogoCrm.Api.Infrastructure;

public static class DealStageLabels
{
    public static string Label(DealStage stage, string? language)
    {
        var lang = NormalizeLanguage(language);
        return stage switch
        {
            DealStage.Lead => lang == "en" ? "Lead" : "Лид",
            DealStage.Negotiation => lang == "en" ? "Negotiation" : "Переговоры",
            DealStage.Closed => lang == "en" ? "Closed" : "Закрыто",
            _ => stage.ToString(),
        };
    }

    public static string DealStageChangedTitle(string? language) =>
        NormalizeLanguage(language) == "en" ? "Deal stage changed" : "Смена стадии сделки";

    private static string NormalizeLanguage(string? language) =>
        string.Equals(language?.Trim(), "en", StringComparison.OrdinalIgnoreCase) ? "en" : "ru";
}
