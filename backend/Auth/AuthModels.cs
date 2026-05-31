namespace ExpogoCrm.Api.Auth;

public record LoginRequest(string Username, string Password);

public record LoginResponse(string AccessToken, string RefreshToken, int TenantId);

public record RefreshRequest(string RefreshToken);

public record RegisterRequest(string Username, string Password, string? FullName, string? Email);

