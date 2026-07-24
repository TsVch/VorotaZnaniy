/**
 * HTML template for Purchase Confirmation email.
 *
 * Sent after a successful payment.succeeded webhook is processed.
 * Includes the document title and a direct link to the Secure Viewer
 * so the user can immediately start reading.
 *
 * @param documentTitle - Title of the document related to the purchase
 * @param viewerUrl - Direct URL to the Secure Viewer for the document
 * @returns Complete HTML string suitable for Resend API
 */
export function renderPurchaseConfirmationTemplate(
  documentTitle: string,
  viewerUrl: string,
): string {
  const escapedTitle = documentTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const escapedUrl = viewerUrl
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="ru" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Подписка оформлена</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px 40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">&#10003;</div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">
                Подписка оформлена!
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;font-weight:600;">
                Спасибо за покупку!
              </h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.5;">
                Ваш тариф <strong>Pro</strong> активирован. Теперь вам доступен
                Secure Viewer с DRM-защитой, AI-ассистент и неограниченное
                количество документов.
              </p>
              <!-- Document info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;color:#166534;font-size:13px;font-weight:600;">Документ</p>
                    <p style="margin:0;color:#065f46;font-size:15px;">${escapedTitle}</p>
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);">
                    <a href="${escapedUrl}"
                       style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Открыть в Secure Viewer
                    </a>
                  </td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px;" />
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                Подписка продлевается автоматически каждый месяц. Вы можете
                отменить её в любое время в настройках аккаунта.
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
