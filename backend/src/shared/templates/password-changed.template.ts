/**
 * HTML template for Password/Email Changed notification email.
 *
 * Uses a calm but serious tone. Sent when the user successfully changes
 * their password or email address. If the user did not initiate this change,
 * they should immediately contact support or recover access.
 *
 * @param changeType - Either 'password' or 'email'
 * @param changeDate - ISO date string of when the change occurred
 * @returns Complete HTML string suitable for Resend API
 */
export function renderPasswordChangedTemplate(
  changeType: 'password' | 'email',
  changeDate: string,
): string {
  const changeLabel = changeType === 'password' ? 'пароль' : 'email';
  const subjectLine = changeType === 'password'
    ? 'Пароль изменён'
    : 'Email изменён';

  const formattedDate = new Date(changeDate).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `<!DOCTYPE html>
<html lang="ru" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subjectLine}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header — Blue / neutral warning -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:32px 40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">&#128274;</div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">
                ${subjectLine}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:600;">
                ${changeLabel.charAt(0).toUpperCase() + changeLabel.slice(1)} был изменён
              </h2>
              <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.5;">
                Ваш <strong>${changeLabel}</strong> был успешно изменён
                <strong>${formattedDate}</strong>.
              </p>
              <!-- Warning card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid #fde68a;">
                <tr>
                  <td style="vertical-align:top;width:24px;font-size:18px;">&#9888;&#65039;</td>
                  <td>
                    <p style="margin:0;color:#92400e;font-size:14px;line-height:1.5;">
                      <strong>Если это были не вы,</strong> немедленно восстановите
                      доступ через форму входа или свяжитесь со службой поддержки
                      для защиты вашего аккаунта.
                    </p>
                  </td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px;" />
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                Это автоматическое уведомление. Если вы совершили это действие,
                можете проигнорировать данное сообщение.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">
          KnowledgeVault &mdash; Ваша безопасная база знаний
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
