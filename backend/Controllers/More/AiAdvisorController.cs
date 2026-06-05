using System.Text.Json;

using ExpogoCrm.Api.Infrastructure;

using ExpogoCrm.Api.Security;

using ExpogoCrm.Api.Services;

using ExpogoCrm.Api.Services.Ai;

using Microsoft.AspNetCore.Authorization;

using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.RateLimiting;



namespace ExpogoCrm.Api.Controllers.More;



[ApiController]

[Route("ai/advisor")]

[Authorize]

public class AiAdvisorController(

    ICurrentTenantAccessor current,

    IAiAdvisorContextService context,

    IAiAdvisorService advisor,

    IAiAdvisorChatService chat,

    IBillingEntitlementsService billing,

    IAuditTrailService audit) : ControllerBase

{

    static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);



    [HttpGet("context")]

    [Authorize(Policy = CrmPermissions.AiAdvisorRead)]

    public async Task<ActionResult<object>> GetContext(CancellationToken ct)

    {

        var tenantId = this.RequireTenantId();

        var reportsError = await CheckBillingAsync(tenantId, ct);

        if (reportsError is not null)

            return reportsError;



        var ctx = await context.BuildAsync(tenantId, ct);

        return Ok(new

        {

            provider = advisor.ProviderName,

            ctx.TenantName,

            ctx.Tier,

            generatedAtUtc = ctx.GeneratedAtUtc,

            totalDeals = ctx.TotalDeals,

            closedDeals = ctx.ClosedDeals,

            conversionPct = ctx.ConversionPct,

            monthRevenueUsd = ctx.MonthRevenueUsd,

            quarterRevenueUsd = ctx.QuarterRevenueUsd,

            overdueTasks = ctx.OverdueTasks,

            clientCount = ctx.ClientCount,

            openTasks = ctx.OpenTasks,

            avgClosedDealUsd = ctx.AvgClosedDealUsd,

            topDeals = ctx.TopDeals,

            stageSlices = ctx.StageSlices,

            monthlyRevenue = ctx.MonthlyRevenue,

        });

    }



    [HttpGet("sessions")]

    [Authorize(Policy = CrmPermissions.AiAdvisorRead)]

    public async Task<ActionResult<object>> ListSessions(CancellationToken ct)

    {

        var tenantId = this.RequireTenantId();

        var userId = RequireUserId();

        if (userId is null) return Unauthorized();



        var billingError = await CheckBillingAsync(tenantId, ct);

        if (billingError is not null) return billingError;



        var items = await chat.ListSessionsAsync(tenantId, userId.Value, ct);

        return Ok(new { items });

    }



    public sealed class CreateSessionRequest

    {

        public string? Title { get; set; }

    }



    [HttpPost("sessions")]

    [Authorize(Policy = CrmPermissions.AiAdvisorRead)]

    public async Task<ActionResult<object>> CreateSession([FromBody] CreateSessionRequest? req, CancellationToken ct)

    {

        var tenantId = this.RequireTenantId();

        var userId = RequireUserId();

        if (userId is null) return Unauthorized();



        var billingError = await CheckBillingAsync(tenantId, ct);

        if (billingError is not null) return billingError;



        var session = await chat.CreateSessionAsync(tenantId, userId.Value, req?.Title, ct);

        return Ok(session);

    }



    [HttpGet("sessions/{sessionId:guid}")]

    [Authorize(Policy = CrmPermissions.AiAdvisorRead)]

    public async Task<ActionResult<object>> GetSession(Guid sessionId, CancellationToken ct)

    {

        var tenantId = this.RequireTenantId();

        var userId = RequireUserId();

        if (userId is null) return Unauthorized();



        var billingError = await CheckBillingAsync(tenantId, ct);

        if (billingError is not null) return billingError;



        var data = await chat.GetSessionAsync(tenantId, userId.Value, sessionId, ct);

        if (data is null)

            return NotFound(new { code = "ai.session_not_found", message = "Сессия чата не найдена." });



        return Ok(new { session = data.Value.Session, messages = data.Value.Messages });

    }



    public sealed class ChatRequest

    {

        public Guid SessionId { get; set; }

        public string Message { get; set; } = "";

    }



    [HttpPost("chat")]

    [EnableRateLimiting("ai-advisor")]

    [Authorize(Policy = CrmPermissions.AiAdvisorRead)]

    public async Task Chat([FromBody] ChatRequest req, CancellationToken ct)

    {

        var tenantId = this.RequireTenantId();

        var userId = RequireUserId();

        if (userId is null)

        {

            Response.StatusCode = StatusCodes.Status401Unauthorized;

            return;

        }



        var billingError = await CheckBillingAsync(tenantId, ct);

        if (billingError is not null)

        {

            await WriteJsonResultAsync(billingError, ct);

            return;

        }



        if (!advisor.IsConfigured)

        {

            Response.StatusCode = StatusCodes.Status503ServiceUnavailable;

            await Response.WriteAsJsonAsync(

                new

                {

                    code = "ai.not_configured",

                    message = "ИИ-советник не настроен. Укажите Ai:Llm:ApiKey (https://openrouter.ai/keys).",

                },

                JsonOpts,

                ct);

            return;

        }



        var message = (req.Message ?? "").Trim();

        if (req.SessionId == Guid.Empty || string.IsNullOrWhiteSpace(message))

        {

            Response.StatusCode = StatusCodes.Status400BadRequest;

            await Response.WriteAsJsonAsync(

                new { code = "ai.invalid_request", message = "Укажите sessionId и текст сообщения." },

                JsonOpts,

                ct);

            return;

        }



        var session = await chat.RequireSessionAsync(tenantId, userId.Value, req.SessionId, ct);

        if (session is null)

        {

            Response.StatusCode = StatusCodes.Status404NotFound;

            await Response.WriteAsJsonAsync(

                new { code = "ai.session_not_found", message = "Сессия чата не найдена." },

                JsonOpts,

                ct);

            return;

        }



        await chat.AppendMessageAsync(req.SessionId, "user", message, ct);

        var history = await chat.LoadHistoryAsync(req.SessionId, ct);



        DisableResponseBuffering();

        Response.StatusCode = StatusCodes.Status200OK;

        Response.ContentType = "text/event-stream; charset=utf-8";

        Response.Headers.CacheControl = "no-cache, no-transform";

        Response.Headers.Connection = "keep-alive";
        Response.Headers["X-Accel-Buffering"] = "no";



        var replyLength = 0;

        var replyBuilder = new System.Text.StringBuilder();

        try

        {

            await foreach (var chunk in advisor.StreamAdviceAsync(tenantId, history, ct))

            {

                replyLength += chunk.Length;

                replyBuilder.Append(chunk);

                await WriteSseEventAsync(new { type = "chunk", text = chunk }, ct);

            }



            if (replyLength == 0)

            {

                Response.StatusCode = StatusCodes.Status502BadGateway;

                await WriteSseEventAsync(

                    new { type = "error", code = "ai.provider_error", message = "Модель вернула пустой ответ." },

                    ct);

                return;

            }



            var reply = replyBuilder.ToString();

            await chat.AppendMessageAsync(req.SessionId, "assistant", reply, ct);

            await chat.TouchSessionAsync(req.SessionId, message, ct);



            await WriteSseEventAsync(

                new

                {

                    type = "done",

                    provider = advisor.ProviderName,

                    generatedAtUtc = DateTime.UtcNow,

                    sessionId = req.SessionId,

                },

                ct);



            await audit.WriteAsync(

                tenantId,

                "ai.advisor.query",

                "AiAdvisor",

                req.SessionId.ToString(),

                null,

                new

                {

                    provider = advisor.ProviderName,

                    sessionId = req.SessionId,

                    messageCount = history.Count,

                    streaming = true,

                    replyLength,

                },

                ct);

        }

        catch (LlmProviderException ex)

        {

            Response.StatusCode = ex.IsAuthError ? StatusCodes.Status403Forbidden : StatusCodes.Status502BadGateway;

            await WriteSseEventAsync(

                new

                {

                    type = "error",

                    code = ex.IsAuthError ? "ai.invalid_key" : "ai.provider_error",

                    message = ex.Message,

                    detail = ex.ProviderBody,

                },

                ct);

        }

        catch (Exception ex)

        {

            Response.StatusCode = StatusCodes.Status502BadGateway;

            await WriteSseEventAsync(

                new { type = "error", code = "ai.provider_error", message = "Ошибка при обращении к LLM.", detail = ex.Message },

                ct);

        }

    }



    async Task WriteJsonResultAsync(ActionResult result, CancellationToken ct)

    {

        if (result is ObjectResult obj)

        {

            Response.StatusCode = obj.StatusCode ?? StatusCodes.Status400BadRequest;

            await Response.WriteAsJsonAsync(obj.Value, JsonOpts, ct);

        }

    }



    void DisableResponseBuffering()

    {

        var feature = HttpContext.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpResponseBodyFeature>();

        feature?.DisableBuffering();

    }



    async Task WriteSseEventAsync(object payload, CancellationToken ct)

    {

        var json = JsonSerializer.Serialize(payload, JsonOpts);

        await Response.WriteAsync($"data: {json}\n\n", ct);

        await Response.Body.FlushAsync(ct);

    }



    async Task<ActionResult?> CheckBillingAsync(int tenantId, CancellationToken ct)

    {

        var check = await billing.EnsureFeatureAsync(tenantId, BillingFeature.AiAdvisor, ct);

        return this.ToBillingActionResult(check);

    }



    int? RequireUserId() => current.UserId;

}

