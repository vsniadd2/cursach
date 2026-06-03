namespace ExpogoCrm.Api.Services.Ai;

public sealed class LlmProviderException : Exception
{
    public int? HttpStatus { get; }
    public string? ProviderBody { get; }

    public LlmProviderException(string message, int? httpStatus = null, string? providerBody = null, Exception? inner = null)
        : base(message, inner)
    {
        HttpStatus = httpStatus;
        ProviderBody = providerBody;
    }

    public bool IsAuthError => HttpStatus is 401 or 403;
}
