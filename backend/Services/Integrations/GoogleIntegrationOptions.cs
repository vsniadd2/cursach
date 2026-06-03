namespace ExpogoCrm.Api.Services.Integrations;

public sealed class GoogleIntegrationOptions
{
    public const string SectionName = "Integrations:Google";

    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string RedirectUri { get; set; } = "http://localhost:5278/integrations/google-calendar/callback";
    public string FrontendSuccessUrl { get; set; } = "http://localhost:8081";
    public string StateSigningKey { get; set; } = "cursach-google-oauth-state-key-min-32-chars";
    public string[] Scopes { get; set; } =
    [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
    ];
}
