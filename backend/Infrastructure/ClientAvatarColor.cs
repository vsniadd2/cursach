namespace ExpogoCrm.Api.Infrastructure;

public static class ClientAvatarColor
{
    public static int AssignHue(int clientId, string fullName, string company)
    {
        var hash = HashCode.Combine(clientId, fullName.Trim(), company.Trim());
        return Math.Abs(hash % 360);
    }

    public static int DefaultHue(int clientId) => (clientId * 47) % 360;
}
