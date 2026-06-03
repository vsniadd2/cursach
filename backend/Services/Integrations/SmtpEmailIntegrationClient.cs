using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ExpogoCrm.Api.Services.Integrations;

public interface ISmtpEmailIntegrationClient
{
    Task SendAsync(EmailIntegrationConfig config, string password, string toEmail, string subject, string body, CancellationToken ct = default);
}

public sealed class SmtpEmailIntegrationClient : ISmtpEmailIntegrationClient
{
    public async Task SendAsync(
        EmailIntegrationConfig config,
        string password,
        string toEmail,
        string subject,
        string body,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(config.SmtpHost))
            throw new InvalidOperationException("Укажите SMTP host.");
        if (string.IsNullOrWhiteSpace(config.FromEmail))
            throw new InvalidOperationException("Укажите email отправителя.");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(config.FromName, config.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        using var client = new SmtpClient();
        var secure = config.UseSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto;
        await client.ConnectAsync(config.SmtpHost, config.SmtpPort, secure, ct);
        if (!string.IsNullOrWhiteSpace(config.SmtpUser))
            await client.AuthenticateAsync(config.SmtpUser, password, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
