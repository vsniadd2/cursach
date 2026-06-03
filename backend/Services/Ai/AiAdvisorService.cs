namespace ExpogoCrm.Api.Services.Ai;

public sealed record AiChatMessageDto(string Role, string Content);

public interface IAiAdvisorService
{
    bool IsConfigured { get; }
    string ProviderName { get; }
    Task<string> GetAdviceAsync(
        int tenantId,
        IReadOnlyList<AiChatMessageDto> history,
        CancellationToken ct = default);
    IAsyncEnumerable<string> StreamAdviceAsync(
        int tenantId,
        IReadOnlyList<AiChatMessageDto> history,
        CancellationToken ct = default);
}

public sealed class AiAdvisorService(
    IAiAdvisorContextService context,
    OpenAiChatLlmClient llm,
    Microsoft.Extensions.Options.IOptions<AiLlmOptions> options) : IAiAdvisorService
{
    const int MaxHistoryMessages = 12;

    static readonly string SystemPromptTemplate = """
        Ты — CRM-аналитик продукта Expogo. Отвечай на русском языке.
        Используй ТОЛЬКО факты из JSON-контекста ниже. Не выдумывай цифры.
        Дай 3–5 конкретных рекомендаций для улучшения продаж и операционной дисциплины.
        Если данных мало — скажи об этом честно и предложи, что отслеживать в CRM.

        Контекст CRM (JSON):
        {0}
        """;

    public bool IsConfigured => options.Value.IsConfigured;

    public string ProviderName => options.Value.Provider;

    public async Task<string> GetAdviceAsync(
        int tenantId,
        IReadOnlyList<AiChatMessageDto> history,
        CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new AiNotConfiguredException();

        var messages = await BuildMessagesAsync(tenantId, history, ct);
        return await llm.CompleteAsync(messages, ct);
    }

    public async IAsyncEnumerable<string> StreamAdviceAsync(
        int tenantId,
        IReadOnlyList<AiChatMessageDto> history,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new AiNotConfiguredException();

        var messages = await BuildMessagesAsync(tenantId, history, ct);
        await foreach (var chunk in llm.StreamCompleteAsync(messages, ct))
            yield return chunk;
    }

    async Task<List<(string Role, string Text)>> BuildMessagesAsync(
        int tenantId,
        IReadOnlyList<AiChatMessageDto> history,
        CancellationToken ct)
    {
        var ctx = await context.BuildAsync(tenantId, ct);
        var ctxJson = context.ToJson(ctx);
        var systemText = string.Format(SystemPromptTemplate, ctxJson);

        var messages = new List<(string Role, string Text)>
        {
            ("system", systemText),
        };

        var trimmed = history
            .Where(m => !string.IsNullOrWhiteSpace(m.Content))
            .TakeLast(MaxHistoryMessages)
            .ToList();

        if (trimmed.Count == 0)
        {
            messages.Add(("user", "Проанализируй текущую статистику CRM и дай рекомендации по улучшению."));
        }
        else
        {
            foreach (var m in trimmed)
            {
                var role = m.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase) ? "assistant" : "user";
                messages.Add((role, m.Content.Trim()));
            }
        }

        return messages;
    }
}

public sealed class AiNotConfiguredException : Exception
{
    public AiNotConfiguredException()
        : base("AI API key is not configured (Ai:Llm:ApiKey).")
    {
    }
}
