/**
 * HTML template for Session Terminated security alert email.
 *
 * Uses a prominent red/warning style to convey urgency.
 * Sent when an existing viewing session is forcefully terminated
 * because a new session was created exceeding the concurrent device limit.
 *
 * @param documentTitle - Title of the document where the session was terminated
 * @param deviceInfo - Information about the new device that triggered the termination
 * @returns Complete HTML string suitable for Resend API
 */
export function renderSessionTerminatedTemplate(
  documentTitle: string,
  deviceInfo: string,
): string {
  const escapedTitle = documentTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const escapedDevice = deviceInfo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="ru" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Сессия завершена — уведомление безопасности</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header — Red alert -->
          <tr>
            <td style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">&#9888;</div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">
                Сессия завершена
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:600;">
                Обнаружен вход с другого устройства
              </h2>
              <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.5;">
                Ваша сессия просмотра документа &laquo;<strong>${escapedTitle}</strong>&raquo;
                была завершена, так как был обнаружен вход с другого устройства.
              </p>
              <!-- Device info card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid #fecaca;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;color:#991b1b;font-size:13px;font-weight:600;">Устройство</p>
                    <p style="margin:0;color:#7f1d1d;font-size:14px;word-break:break-word;">${escapedDevice}</p>
                  </td>
                </tr>
              </table>
              <!-- Warning -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid #fde68a;">
                <tr>
                  <td style="vertical-align:top;width:24px;font-size:18px;">&#9888;&#65039;</td>
                  <td>
                    <p style="margin:0;color:#92400e;font-size:14px;line-height:1.5;">
                      <strong>Если это были не вы,</strong> немедленно смените пароль в настройках аккаунта и свяжитесь со службой поддержки.
                    </p>
                  </td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px;" />
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                Это автоматическое уведомление. Если вы узнали это устройство,
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
