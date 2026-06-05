using ExpogoCrm.Api.Data;
using ExpogoCrm.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ExpogoCrm.Api.Services;

public sealed record CloudFileDto(
    long Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    string UploadedBy,
    DateTime CreatedAtUtc);

public sealed record CloudStorageOverviewDto(
    int StorageGbPerSeat,
    int ActiveSeats,
    decimal StorageGbTotalLimit,
    decimal StorageGbUsed,
    long LimitBytes,
    long UsedBytes,
    IReadOnlyList<CloudFileDto> Items);

public interface ICloudStorageService
{
    Task<CloudStorageOverviewDto> GetOverviewAsync(int tenantId, CancellationToken ct = default);
    Task<CloudFileDto> UploadAsync(int tenantId, int userId, string fileName, string contentType, Stream content, CancellationToken ct = default);
    Task DeleteAsync(int tenantId, long fileId, CancellationToken ct = default);
    Task<(TenantCloudFile Meta, string AbsolutePath)> GetFileForDownloadAsync(int tenantId, long fileId, CancellationToken ct = default);
}

public sealed class CloudStorageService(
    ExpogoDbContext db,
    IBillingEntitlementsService billing,
    IOptions<CloudStorageOptions> options) : ICloudStorageService
{
    public async Task<CloudStorageOverviewDto> GetOverviewAsync(int tenantId, CancellationToken ct = default)
    {
        var quota = await billing.GetStorageQuotaAsync(tenantId, ct);
        var items = await db.TenantCloudFiles.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Include(x => x.UploadedByUser)
            .Take(500)
            .Select(x => new CloudFileDto(
                x.Id,
                x.FileName,
                x.ContentType,
                x.SizeBytes,
                x.UploadedByUser.FullName ?? x.UploadedByUser.Username,
                x.CreatedAtUtc))
            .ToListAsync(ct);

        return new CloudStorageOverviewDto(
            quota.StorageGbPerSeat,
            quota.ActiveSeats,
            quota.StorageGbTotalLimit,
            quota.StorageGbUsed,
            quota.LimitBytes,
            quota.UsedBytes,
            items);
    }

    public async Task<CloudFileDto> UploadAsync(
        int tenantId,
        int userId,
        string fileName,
        string contentType,
        Stream content,
        CancellationToken ct = default)
    {
        var cfg = options.Value;
        if (content.CanSeek)
        {
            var size = content.Length;
            if (size > cfg.MaxUploadBytes)
                throw new InvalidOperationException($"Файл больше {cfg.MaxUploadBytes / (1024 * 1024)} МБ.");

            var check = await billing.EnsureCanUploadStorageAsync(tenantId, size, ct);
            if (!check.Allowed)
                throw new BillingLimitException(check.Code ?? BillingLimitCodes.Storage, check.Message ?? "Лимит хранилища.");
        }

        var safeName = SanitizeFileName(fileName);
        var root = ResolveRoot(cfg.RootPath);
        Directory.CreateDirectory(Path.Combine(root, tenantId.ToString()));

        var storageKey = $"{tenantId}/{Guid.NewGuid():N}_{safeName}";
        var absolutePath = Path.Combine(root, storageKey.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(absolutePath)!);

        long written;
        await using (var fs = new FileStream(absolutePath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            await content.CopyToAsync(fs, ct);
            written = fs.Length;
        }

        if (written > cfg.MaxUploadBytes)
        {
            File.Delete(absolutePath);
            throw new InvalidOperationException($"Файл больше {cfg.MaxUploadBytes / (1024 * 1024)} МБ.");
        }

        var quotaCheck = await billing.EnsureCanUploadStorageAsync(tenantId, written, ct);
        if (!quotaCheck.Allowed)
        {
            File.Delete(absolutePath);
            throw new BillingLimitException(quotaCheck.Code ?? BillingLimitCodes.Storage, quotaCheck.Message ?? "Лимит хранилища.");
        }

        var entity = new TenantCloudFile
        {
            TenantId = tenantId,
            UploadedByUserId = userId,
            FileName = safeName,
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType.Trim(),
            SizeBytes = written,
            StorageKey = storageKey,
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.TenantCloudFiles.Add(entity);
        await db.SaveChangesAsync(ct);

        var user = await db.Users.AsNoTracking().SingleAsync(x => x.Id == userId, ct);
        return new CloudFileDto(
            entity.Id,
            entity.FileName,
            entity.ContentType,
            entity.SizeBytes,
            user.FullName ?? user.Username,
            entity.CreatedAtUtc);
    }

    public async Task DeleteAsync(int tenantId, long fileId, CancellationToken ct = default)
    {
        var file = await db.TenantCloudFiles.SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == fileId, ct)
            ?? throw new KeyNotFoundException("Файл не найден.");

        var root = ResolveRoot(options.Value.RootPath);
        var absolutePath = Path.Combine(root, file.StorageKey.Replace('/', Path.DirectorySeparatorChar));
        if (File.Exists(absolutePath))
            File.Delete(absolutePath);

        db.TenantCloudFiles.Remove(file);
        await db.SaveChangesAsync(ct);
    }

    public async Task<(TenantCloudFile Meta, string AbsolutePath)> GetFileForDownloadAsync(
        int tenantId,
        long fileId,
        CancellationToken ct = default)
    {
        var file = await db.TenantCloudFiles.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TenantId == tenantId && x.Id == fileId, ct)
            ?? throw new KeyNotFoundException("Файл не найден.");

        var root = ResolveRoot(options.Value.RootPath);
        var absolutePath = Path.Combine(root, file.StorageKey.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(absolutePath))
            throw new FileNotFoundException("Файл на диске не найден.");

        return (file, absolutePath);
    }

    static string ResolveRoot(string configured) =>
        Path.GetFullPath(string.IsNullOrWhiteSpace(configured) ? "./data/cloud" : configured.Trim());

    static string SanitizeFileName(string name)
    {
        var trimmed = Path.GetFileName(name.Trim());
        if (string.IsNullOrWhiteSpace(trimmed))
            return "file.bin";

        foreach (var c in Path.GetInvalidFileNameChars())
            trimmed = trimmed.Replace(c, '_');

        return trimmed.Length > 200 ? trimmed[..200] : trimmed;
    }
}

public sealed class BillingLimitException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
