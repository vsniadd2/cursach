namespace ExpogoCrm.Api.Services.Ai;

public sealed class AiLlmOptions
{
    public const string SectionName = "Ai:Llm";

    /// <summary>openrouter | groq | openai</summary>
    public string Provider { get; set; } = "openrouter";

    public string ApiKey { get; set; } = "";

    /// <summary>OpenAI-совместимый base URL (без завершающего слэша).</summary>
    public string BaseUrl { get; set; } = "https://openrouter.ai/api/v1";

    /// <summary>Идентификатор модели у провайдера, напр. openai/gpt-4o-mini.</summary>
    public string Model { get; set; } = "openai/gpt-4o-mini";

    /// <summary>Опционально для OpenRouter (HTTP-Referer).</summary>
    public string? SiteUrl { get; set; }

    /// <summary>Опционально для OpenRouter (X-Title).</summary>
    public string? AppName { get; set; }

    public int MaxTokens { get; set; } = 2000;
    public double Temperature { get; set; } = 0.4;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
