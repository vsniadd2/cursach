using ExpogoCrm.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ExpogoCrm.Api.Services.Ai;

public sealed record AiAdvisorSessionDto(
    Guid Id,
    string Title,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    string? Preview);

public sealed record AiAdvisorMessageDto(
    long Id,
    string Role,
    string Content,
    DateTime CreatedAtUtc);

public interface IAiAdvisorChatService
{
    Task<IReadOnlyList<AiAdvisorSessionDto>> ListSessionsAsync(int tenantId, int userId, CancellationToken ct = default);
    Task<AiAdvisorSessionDto> CreateSessionAsync(int tenantId, int userId, string? title, CancellationToken ct = default);
    Task<(AiAdvisorSessionDto Session, IReadOnlyList<AiAdvisorMessageDto> Messages)?> GetSessionAsync(
        int tenantId,
        int userId,
        Guid sessionId,
        CancellationToken ct = default);
    Task<AiAdvisorSession?> RequireSessionAsync(int tenantId, int userId, Guid sessionId, CancellationToken ct = default);
    Task<AiAdvisorMessage> AppendMessageAsync(Guid sessionId, string role, string content, CancellationToken ct = default);
    Task TouchSessionAsync(Guid sessionId, string? titleFromFirstUserMessage, CancellationToken ct = default);
    Task<IReadOnlyList<AiChatMessageDto>> LoadHistoryAsync(Guid sessionId, CancellationToken ct = default);
}

public sealed class AiAdvisorChatService(ExpogoDbContext db) : IAiAdvisorChatService
{
    const string DefaultTitle = "Новый чат";
    const int PreviewMaxLen = 80;
    const int TitleMaxLen = 120;

    public async Task<IReadOnlyList<AiAdvisorSessionDto>> ListSessionsAsync(int tenantId, int userId, CancellationToken ct = default)
    {
        var sessions = await db.AiAdvisorSessions.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.UserId == userId)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Take(50)
            .ToListAsync(ct);

        if (sessions.Count == 0)
            return [];

        var ids = sessions.Select(x => x.Id).ToList();
        var previews = await db.AiAdvisorMessages.AsNoTracking()
            .Where(x => ids.Contains(x.SessionId))
            .GroupBy(x => x.SessionId)
            .Select(g => new
            {
                SessionId = g.Key,
                Preview = g.OrderByDescending(m => m.CreatedAtUtc)
                    .Select(m => m.Content)
                    .FirstOrDefault(),
            })
            .ToDictionaryAsync(x => x.SessionId, x => x.Preview, ct);

        return sessions
            .Select(s => ToSessionDto(s, previews.GetValueOrDefault(s.Id)))
            .ToList();
    }

    public async Task<AiAdvisorSessionDto> CreateSessionAsync(int tenantId, int userId, string? title, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var session = new AiAdvisorSession
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            Title = TrimTitle(title) ?? DefaultTitle,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        db.AiAdvisorSessions.Add(session);
        await db.SaveChangesAsync(ct);
        return ToSessionDto(session, null);
    }

    public async Task<(AiAdvisorSessionDto Session, IReadOnlyList<AiAdvisorMessageDto> Messages)?> GetSessionAsync(
        int tenantId,
        int userId,
        Guid sessionId,
        CancellationToken ct = default)
    {
        var session = await db.AiAdvisorSessions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == sessionId && x.TenantId == tenantId && x.UserId == userId, ct);
        if (session is null)
            return null;

        var messages = await db.AiAdvisorMessages.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new AiAdvisorMessageDto(x.Id, x.Role, x.Content, x.CreatedAtUtc))
            .ToListAsync(ct);

        var preview = messages.LastOrDefault()?.Content;
        return (ToSessionDto(session, preview), messages);
    }

    public Task<AiAdvisorSession?> RequireSessionAsync(int tenantId, int userId, Guid sessionId, CancellationToken ct = default) =>
        db.AiAdvisorSessions.FirstOrDefaultAsync(x => x.Id == sessionId && x.TenantId == tenantId && x.UserId == userId, ct);

    public async Task<AiAdvisorMessage> AppendMessageAsync(Guid sessionId, string role, string content, CancellationToken ct = default)
    {
        var msg = new AiAdvisorMessage
        {
            SessionId = sessionId,
            Role = role,
            Content = content.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.AiAdvisorMessages.Add(msg);
        await db.SaveChangesAsync(ct);
        return msg;
    }

    public async Task TouchSessionAsync(Guid sessionId, string? titleFromFirstUserMessage, CancellationToken ct = default)
    {
        var session = await db.AiAdvisorSessions.FirstOrDefaultAsync(x => x.Id == sessionId, ct);
        if (session is null)
            return;

        session.UpdatedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(titleFromFirstUserMessage)
            && (session.Title == DefaultTitle || string.IsNullOrWhiteSpace(session.Title)))
        {
            session.Title = TrimTitle(titleFromFirstUserMessage) ?? session.Title;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<AiChatMessageDto>> LoadHistoryAsync(Guid sessionId, CancellationToken ct = default)
    {
        var rows = await db.AiAdvisorMessages.AsNoTracking()
            .Where(x => x.SessionId == sessionId)
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new { x.Role, x.Content })
            .ToListAsync(ct);

        return rows
            .Select(x => new AiChatMessageDto(x.Role, x.Content))
            .ToList();
    }

    static AiAdvisorSessionDto ToSessionDto(AiAdvisorSession s, string? preview) =>
        new(
            s.Id,
            s.Title,
            s.CreatedAtUtc,
            s.UpdatedAtUtc,
            TruncatePreview(preview));

    static string? TruncatePreview(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;
        var t = text.Trim().ReplaceLineEndings(" ");
        return t.Length <= PreviewMaxLen ? t : t[..PreviewMaxLen] + "…";
    }

    static string? TrimTitle(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;
        var t = text.Trim().ReplaceLineEndings(" ");
        return t.Length <= TitleMaxLen ? t : t[..TitleMaxLen] + "…";
    }
}
