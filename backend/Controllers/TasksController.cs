using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using ExpogoCrm.Api.Security;
using ExpogoCrm.Api.Services;
using ExpogoCrm.Api.Services.Integrations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("tasks")]
[Authorize]
public class TasksController : ControllerBase
{
    private readonly ExpogoDbContext _db;
    private readonly IAuditTrailService _audit;
    private readonly INotificationService _notifications;
    private readonly ICurrentTenantAccessor _current;
    private readonly IIntegrationDispatchService _integrations;

    public TasksController(
        ExpogoDbContext db,
        IAuditTrailService audit,
        INotificationService notifications,
        ICurrentTenantAccessor current,
        IIntegrationDispatchService integrations)
    {
        _db = db;
        _audit = audit;
        _notifications = notifications;
        _current = current;
        _integrations = integrations;
    }

    public class TaskUpsertRequest
    {
        public DateOnly Date { get; set; }

        [Required, MaxLength(160)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(512)]
        public string? Description { get; set; }

        [MaxLength(64)]
        public string? AssigneeName { get; set; }

        public TimeOnly? Time { get; set; }

        public TaskPriority Priority { get; set; }

        public bool Done { get; set; }
    }

    public record BulkDoneRequest(List<int> TaskIds, bool Done);

    [HttpGet]
    [Authorize(Policy = CrmPermissions.TasksRead)]
    public async Task<ActionResult<object>> Get(
        [FromQuery] string? date,
        [FromQuery] bool? done,
        [FromQuery] TaskPriority? priority,
        [FromQuery] string? q,
        CancellationToken ct
    )
    {
        var tenantId = this.RequireTenantId();
        var day = string.IsNullOrWhiteSpace(date)
            ? DateOnly.FromDateTime(DateTime.UtcNow)
            : DateOnly.Parse(date);

        var query = _db.Tasks.AsQueryable().Where(t => t.Date == day && t.TenantId == tenantId);

        if (done is not null) query = query.Where(t => t.Done == done.Value);
        if (priority is not null) query = query.Where(t => t.Priority == priority.Value);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(t => t.Title.ToLower().Contains(term) || (t.Description != null && t.Description.ToLower().Contains(term)));
        }

        var items = await query
            .OrderBy(t => t.Done)
            .ThenBy(t => t.Time)
            .Select(t => new
            {
                t.Id,
                t.Date,
                t.Title,
                t.Description,
                t.AssigneeName,
                t.Time,
                t.Priority,
                t.Done,
                t.CreatedAtUtc,
            })
            .ToListAsync(ct);

        var doneCount = items.Count(x => x.Done);
        var totalCount = items.Count;

        return Ok(new { date = day, done = doneCount, total = totalCount, items });
    }

    [HttpGet("{id:int}")]
    [Authorize(Policy = CrmPermissions.TasksRead)]
    public async Task<ActionResult<object>> GetOne(int id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var t = await _db.Tasks.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (t is null) return NotFound(new { message = "Задача не найдена" });
        return Ok(new
        {
            t.Id,
            t.Date,
            t.Title,
            t.Description,
            t.AssigneeName,
            t.Time,
            t.Priority,
            t.Done,
            t.CreatedAtUtc,
        });
    }

    [HttpPost]
    [Authorize(Policy = CrmPermissions.TasksWrite)]
    public async Task<ActionResult<object>> Create([FromBody] TaskUpsertRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var title = req.Title.Trim();
        if (title.Length == 0) return BadRequest(new { message = "Название не может быть пустым" });

        var item = new TaskItem
        {
            TenantId = tenantId,
            Date = req.Date,
            Title = title,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            AssigneeName = string.IsNullOrWhiteSpace(req.AssigneeName) ? null : req.AssigneeName.Trim(),
            Time = req.Time,
            Priority = req.Priority,
            Done = req.Done,
            CreatedAtUtc = DateTime.UtcNow,
        };

        _db.Tasks.Add(item);
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "tasks.create", nameof(TaskItem), item.Id.ToString(), null, item, ct);
        _integrations.SyncTaskToCalendar(tenantId, item.Id);
        if (item.Priority == TaskPriority.High)
        {
            await _notifications.NotifyTenantExceptAsync(
                tenantId,
                _current.UserId,
                NotificationTypes.TaskHighPriority,
                "Новая срочная задача",
                $"«{item.Title}» — {item.Date:dd.MM.yyyy}",
                nameof(TaskItem),
                item.Id.ToString(),
                $"task-high:{item.Id}",
                ct
            );
        }
        await NotifyAssigneeIfNeededAsync(tenantId, item, previousAssigneeName: null, ct);
        return CreatedAtAction(nameof(GetOne), new { id = item.Id }, new { id = item.Id });
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = CrmPermissions.TasksWrite)]
    public async Task<ActionResult> Update(int id, [FromBody] TaskUpsertRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var item = await _db.Tasks.SingleOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (item is null) return NotFound(new { message = "Задача не найдена" });
        var before = new { item.Date, item.Title, item.Priority, item.Done };
        var previousAssigneeName = item.AssigneeName;

        var title = req.Title.Trim();
        if (title.Length == 0) return BadRequest(new { message = "Название не может быть пустым" });

        item.Date = req.Date;
        item.Title = title;
        item.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        item.AssigneeName = string.IsNullOrWhiteSpace(req.AssigneeName) ? null : req.AssigneeName.Trim();
        item.Time = req.Time;
        item.Priority = req.Priority;
        item.Done = req.Done;

        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "tasks.update", nameof(TaskItem), item.Id.ToString(), before, item, ct);
        _integrations.SyncTaskToCalendar(tenantId, item.Id);
        await NotifyAssigneeIfNeededAsync(tenantId, item, previousAssigneeName, ct);
        return NoContent();
    }

    public record ToggleDoneRequest(bool Done);

    [HttpPatch("{id:int}/done")]
    [Authorize(Policy = CrmPermissions.TasksWrite)]
    public async Task<ActionResult> SetDone(int id, [FromBody] ToggleDoneRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var task = await _db.Tasks.SingleOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, ct);
        if (task is null) return NotFound(new { message = "Задача не найдена" });
        var before = task.Done;
        task.Done = req.Done;
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "tasks.toggle-done", nameof(TaskItem), task.Id.ToString(), new { Done = before }, new { Done = req.Done }, ct);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = CrmPermissions.TasksWrite)]
    public async Task<ActionResult> Delete(int id, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var task = await _db.Tasks.SingleOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, ct);
        if (task is null) return NotFound(new { message = "Задача не найдена" });
        var before = new { task.Id, task.Title, task.Date };
        var googleEventId = task.GoogleEventId;
        _db.Tasks.Remove(task);
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "tasks.delete", nameof(TaskItem), id.ToString(), before, null, ct);
        _integrations.DeleteTaskFromCalendar(tenantId, id, googleEventId);
        return NoContent();
    }

    [HttpPatch("bulk/done")]
    [Authorize(Policy = CrmPermissions.TasksWrite)]
    public async Task<ActionResult<object>> BulkDone([FromBody] BulkDoneRequest req, CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var tasks = await _db.Tasks.Where(x => x.TenantId == tenantId && req.TaskIds.Contains(x.Id)).ToListAsync(ct);
        foreach (var task in tasks) task.Done = req.Done;
        await _db.SaveChangesAsync(ct);
        await _audit.WriteAsync(tenantId, "tasks.bulk-done", nameof(TaskItem), "bulk", null, new { req.TaskIds, req.Done }, ct);
        return Ok(new { updated = tasks.Count });
    }

    [HttpGet("reminders/overdue")]
    [Authorize(Policy = CrmPermissions.TasksRead)]
    public async Task<ActionResult<object>> OverdueReminders(CancellationToken ct)
    {
        var tenantId = this.RequireTenantId();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var overdue = await _db.Tasks.AsNoTracking()
            .Where(x => x.TenantId == tenantId && !x.Done && x.Date < today)
            .OrderBy(x => x.Date)
            .Take(50)
            .Select(x => new { x.Id, x.Date, x.Title, x.Priority, x.AssigneeName })
            .ToListAsync(ct);
        return Ok(new { total = overdue.Count, items = overdue });
    }

    private async Task NotifyAssigneeIfNeededAsync(
        int tenantId,
        TaskItem item,
        string? previousAssigneeName,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(item.AssigneeName))
            return;

        var newName = item.AssigneeName.Trim();
        if (string.Equals(previousAssigneeName?.Trim(), newName, StringComparison.OrdinalIgnoreCase))
            return;

        var assigneeUserId = await ResolveAssigneeUserIdAsync(tenantId, newName, ct);
        if (assigneeUserId is null)
            return;

        if (_current.UserId is not null && assigneeUserId.Value == _current.UserId.Value)
            return;

        var body = $"«{item.Title}» — {item.Date:dd.MM.yyyy}";
        if (item.Time is not null)
            body += $" в {item.Time:HH\\:mm}";

        await _notifications.NotifyUserAsync(
            tenantId,
            assigneeUserId.Value,
            NotificationTypes.TaskAssignedByManager,
            "Задача от руководителя",
            body,
            nameof(TaskItem),
            item.Id.ToString(),
            $"task-assigned:{item.Id}:{assigneeUserId.Value}",
            ct
        );
    }

    private async Task<int?> ResolveAssigneeUserIdAsync(int tenantId, string assigneeName, CancellationToken ct)
    {
        var name = assigneeName.Trim();
        if (name.Length == 0)
            return null;

        var members = await _db.TenantMemberships.AsNoTracking()
            .Where(x => x.TenantId == tenantId && !x.User.IsBlocked)
            .Select(x => new { x.UserId, x.User.Username, x.User.FullName })
            .ToListAsync(ct);

        foreach (var m in members)
        {
            var display = string.IsNullOrWhiteSpace(m.FullName) ? m.Username : m.FullName.Trim();
            if (string.Equals(display, name, StringComparison.OrdinalIgnoreCase))
                return m.UserId;
        }

        return null;
    }
}

