namespace ExpogoCrm.Api.Infrastructure;

public sealed class CloudStorageOptions
{
    public const string SectionName = "Storage";

    public string RootPath { get; set; } = "./data/cloud";

    public long MaxUploadBytes { get; set; } = 100L * 1024L * 1024L;
}
