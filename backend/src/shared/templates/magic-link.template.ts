/**
 * HTML template for Magic Link authentication email.
 *
 * Renders a clean, responsive email with a call-to-action button
 * linking the user to the verification page. Inline CSS for
 * compatibility across major email clients (Gmail, Outlook, Apple Mail).
 *
 * @param magicLink - Full verification URL (frontend /auth/verify-magic-link?token=...)
 * @param expiryMinutes - Token TTL in minutes (default 15)
 * @returns Complete HTML string suitable for Resend API
 */
export function renderMagicLinkTemplate(
  magicLink: string,
  expiryMinutes = 15,
): string {
  const escapedLink = magicLink
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return `<!DOCTYPE html>
<html lang="ru" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Вход в KnowledgeVault</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">
                KnowledgeVault
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;font-weight:600;">
                Вход в систему
              </h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.5;">
                Нажмите кнопку ниже, чтобы войти в свою учётную запись KnowledgeVault.
                Ссылка действительна в течение <strong>${expiryMinutes} минут</strong>.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);">
                    <a href="${escapedLink}"
                       style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Войти в KnowledgeVault
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Fallback link -->
              <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;line-height:1.5;">
                Если кнопка не работает, скопируйте и вставьте ссылку в браузер:
              </p>
              <p style="margin:0;color:#6366f1;font-size:13px;word-break:break-all;line-height:1.5;">
                ${escapedLink}
              </p>
              <!-- Footer -->
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px;" />
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                Если вы не запрашивали вход, проигнорируйте это письмо.
              </p>
            </td>
          </tr>
        </table>
        <!-- Brand footer -->
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">
          KnowledgeVault &mdash; Ваша безопасная база знаний
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
