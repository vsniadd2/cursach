using System.Net.Http.Headers;

using System.Net.Http.Json;

using System.Runtime.CompilerServices;

using System.Text.Json;

using Microsoft.Extensions.Options;



namespace ExpogoCrm.Api.Services.Ai;



/// <summary>

/// OpenAI-совместимый chat/completions (OpenRouter, Groq, OpenAI и др.).

/// </summary>

public sealed class OpenAiChatLlmClient(HttpClient http, IOptions<AiLlmOptions> options)

{

    public async Task<string> CompleteAsync(

        IReadOnlyList<(string Role, string Text)> messages,

        CancellationToken ct = default)

    {

        var sb = new System.Text.StringBuilder();

        await foreach (var chunk in StreamCompleteAsync(messages, ct))

            sb.Append(chunk);

        var text = sb.ToString().Trim();

        if (text.Length == 0)

            throw new LlmProviderException("Модель вернула пустой ответ.");

        return text;

    }



    public async IAsyncEnumerable<string> StreamCompleteAsync(

        IReadOnlyList<(string Role, string Text)> messages,

        [EnumeratorCancellation] CancellationToken ct = default)

    {

        var cfg = options.Value;

        if (!cfg.IsConfigured)

            throw new InvalidOperationException("AI LLM API key is not configured.");



        var openAiMessages = ToOpenAiMessages(messages);

        if (openAiMessages.Length == 0)

            throw new LlmProviderException("Нет сообщений для отправки в модель.");



        var payload = new

        {

            model = cfg.Model.Trim(),

            messages = openAiMessages,

            temperature = cfg.Temperature,

            max_tokens = cfg.MaxTokens,

            stream = true,

        };



        var baseUrl = cfg.BaseUrl.TrimEnd('/');

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/chat/completions");

        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", cfg.ApiKey.Trim());

        if (!string.IsNullOrWhiteSpace(cfg.SiteUrl))

            req.Headers.TryAddWithoutValidation("HTTP-Referer", cfg.SiteUrl.Trim());

        if (!string.IsNullOrWhiteSpace(cfg.AppName))

            req.Headers.TryAddWithoutValidation("X-Title", cfg.AppName.Trim());

        req.Content = JsonContent.Create(payload);



        using var res = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

        if (!res.IsSuccessStatusCode)

        {

            var body = await res.Content.ReadAsStringAsync(ct);

            throw new LlmProviderException(

                $"LLM HTTP {(int)res.StatusCode} ({cfg.Provider})",

                (int)res.StatusCode,

                body);

        }



        await using var stream = await res.Content.ReadAsStreamAsync(ct);

        using var reader = new StreamReader(stream);



        while (true)
        {
            ct.ThrowIfCancellationRequested();
            var line = await reader.ReadLineAsync(ct);
            if (line is null)
                break;

            if (!line.StartsWith("data:", StringComparison.Ordinal))

                continue;



            var data = line.Length > 5 ? line[5..].TrimStart() : "";

            if (data.Length == 0 || data == "[DONE]")

                continue;



            string? deltaText = null;

            try

            {

                using var doc = JsonDocument.Parse(data);

                var root = doc.RootElement;

                if (root.TryGetProperty("error", out var err)

                    && err.TryGetProperty("message", out var errMsg)

                    && errMsg.ValueKind == JsonValueKind.String)

                {

                    throw new LlmProviderException(errMsg.GetString() ?? "LLM stream error", providerBody: data);

                }



                if (root.TryGetProperty("choices", out var choices)

                    && choices.GetArrayLength() > 0

                    && choices[0].TryGetProperty("delta", out var delta)

                    && delta.TryGetProperty("content", out var content)

                    && content.ValueKind == JsonValueKind.String)

                {

                    deltaText = content.GetString();

                }

            }

            catch (JsonException)

            {

                continue;

            }



            if (!string.IsNullOrEmpty(deltaText))

                yield return deltaText;

        }

    }



    static object[] ToOpenAiMessages(IReadOnlyList<(string Role, string Text)> messages) =>

        messages

            .Where(m => !string.IsNullOrWhiteSpace(m.Text))

            .Select(m => new

            {

                role = m.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase)

                    ? "assistant"

                    : m.Role.Equals("system", StringComparison.OrdinalIgnoreCase)

                        ? "system"

                        : "user",

                content = m.Text.Trim(),

            })

            .ToArray();

}


