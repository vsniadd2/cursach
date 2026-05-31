using ExpogoCrm.Api.Auth;
using ExpogoCrm.Api.Data;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace ExpogoCrm.Api.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly ExpogoDbContext _db;
    private readonly JwtTokenService _tokens;
    private readonly IConfiguration _cfg;
    private const int MaxLoginAttempts = 5;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);

    public AuthController(ExpogoDbContext db, JwtTokenService tokens, IConfiguration cfg)
    {
        _db = db;
        _tokens = tokens;
        _cfg = cfg;
    }

    [HttpPost("register")]
    [EnableRateLimiting("auth-login")]
    public async Task<ActionResult<LoginResponse>> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        var username = req.Username.Trim();
        if (username.Length < 3) return BadRequest(new { message = "Логин слишком короткий" });
        if (req.Password.Length < 6) return BadRequest(new { message = "Пароль должен быть минимум 6 символов" });

        var email = req.Email?.Trim();
        if (!string.IsNullOrEmpty(email))
        {
            var ok = Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");
            if (!ok) return BadRequest(new { message = "Некорректный email" });
        }

        var existsUser = await _db.Users.AnyAsync(x => x.Username == username, ct);
        if (existsUser) return Conflict(new { message = "Логин уже занят" });

        if (!string.IsNullOrEmpty(email))
        {
            var existsEmail = await _db.Users.AnyAsync(x => x.Email == email, ct);
            if (existsEmail) return Conflict(new { message = "Email уже занят" });
        }

        var user = new AppUser
        {
            Username = username,
            FullName = string.IsNullOrWhiteSpace(req.FullName) ? null : req.FullName.Trim(),
            Email = string.IsNullOrWhiteSpace(email) ? null : email,
            PasswordHash = PasswordHasher.Hash(req.Password),
            UiTheme = "light",
            CurrencyCode = "BYN",
        };
        var tenantName = string.IsNullOrWhiteSpace(req.FullName) ? $"{username} workspace" : req.FullName!.Trim();
        var tenant = new Tenant
        {
            Name = tenantName,
            Slug = $"{username}-{Guid.NewGuid().ToString("N")[..6]}".ToLowerInvariant(),
            PlanCode = "starter",
        };
        _db.Users.Add(user);
        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync(ct);

        _db.TenantMemberships.Add(new TenantMembership
        {
            TenantId = tenant.Id,
            UserId = user.Id,
            Role = TenantRole.Owner,
        });
        _db.BillingSubscriptions.Add(new BillingSubscription
        {
            TenantId = tenant.Id,
            PlanCode = "starter",
            Status = "active",
            SeatsLimit = 5,
            StorageGbLimit = 5,
        });
        await _db.SaveChangesAsync(ct);

        // сразу логиним
        var access = _tokens.CreateAccessToken(user, tenant.Id, TenantRole.Owner);
        var refresh = JwtTokenService.CreateRefreshToken();
        var refreshHash = JwtTokenService.HashRefreshToken(refresh);
        var days = int.Parse(_cfg["Jwt:RefreshTokenDays"] ?? "30");

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = refreshHash,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(days),
        });
        await _db.SaveChangesAsync(ct);

        return new LoginResponse(access, refresh, tenant.Id);
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth-login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var username = req.Username.Trim();
        var user = await _db.Users.SingleOrDefaultAsync(x => x.Username == username, ct);
        if (user is null)
        {
            return Unauthorized(new { message = "Неверный логин или пароль" });
        }

        if (user.LockoutEndUtc is not null && user.LockoutEndUtc > DateTime.UtcNow)
            return StatusCode(423, new { message = "Аккаунт временно заблокирован. Повторите попытку позже." });

        if (!PasswordHasher.Verify(req.Password, user.PasswordHash))
        {
            user.FailedLoginAttempts += 1;
            if (user.FailedLoginAttempts >= MaxLoginAttempts)
            {
                user.LockoutEndUtc = DateTime.UtcNow.Add(LockoutWindow);
                user.FailedLoginAttempts = 0;
            }
            await _db.SaveChangesAsync(ct);
            return Unauthorized(new { message = "Неверный логин или пароль" });
        }

        user.FailedLoginAttempts = 0;
        user.LockoutEndUtc = null;
        await _db.SaveChangesAsync(ct);

        var membership = await _db.TenantMemberships.AsNoTracking()
            .Where(x => x.UserId == user.Id)
            .OrderBy(x => x.TenantId)
            .FirstOrDefaultAsync(ct);
        if (membership is null) return Forbid();

        var access = _tokens.CreateAccessToken(user, membership.TenantId, membership.Role);
        var refresh = JwtTokenService.CreateRefreshToken();
        var refreshHash = JwtTokenService.HashRefreshToken(refresh);
        var days = int.Parse(_cfg["Jwt:RefreshTokenDays"] ?? "30");

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = refreshHash,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(days),
        });
        await _db.SaveChangesAsync(ct);

        return new LoginResponse(access, refresh, membership.TenantId);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<LoginResponse>> Refresh([FromBody] RefreshRequest req, CancellationToken ct)
    {
        var oldHash = JwtTokenService.HashRefreshToken(req.RefreshToken);
        var stored = await _db.RefreshTokens
            .Include(x => x.User)
            .SingleOrDefaultAsync(x => x.TokenHash == oldHash, ct);

        if (stored is null) return Unauthorized(new { message = "Refresh token не найден" });
        if (stored.RevokedAtUtc is not null) return Unauthorized(new { message = "Refresh token отозван" });
        if (stored.ExpiresAtUtc <= DateTime.UtcNow) return Unauthorized(new { message = "Refresh token истёк" });

        var user = stored.User;
        var membership = await _db.TenantMemberships.AsNoTracking()
            .Where(x => x.UserId == user.Id)
            .OrderBy(x => x.TenantId)
            .FirstOrDefaultAsync(ct);
        if (membership is null) return Forbid();

        var newAccess = _tokens.CreateAccessToken(user, membership.TenantId, membership.Role);
        var newRefresh = JwtTokenService.CreateRefreshToken();
        var newHash = JwtTokenService.HashRefreshToken(newRefresh);
        var days = int.Parse(_cfg["Jwt:RefreshTokenDays"] ?? "30");

        stored.ReplacedAtUtc = DateTime.UtcNow;
        stored.ReplacedByTokenHash = newHash;

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = newHash,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(days),
        });

        await _db.SaveChangesAsync(ct);

        return new LoginResponse(newAccess, newRefresh, membership.TenantId);
    }
}

