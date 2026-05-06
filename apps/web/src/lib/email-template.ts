import { getTenantConfig } from "./tenant"

interface EmailTemplateParams {
  subject: string
  body: string
  deadline?: string | null
  courseName?: string | null
  senderName: string
}

/**
 * Generates branded HTML email for academy notifications.
 */
export function buildNotificationEmail({
  subject,
  body,
  deadline,
  courseName,
  senderName,
}: EmailTemplateParams): string {
  const config = getTenantConfig()
  const { brand } = config
  const primaryColor = brand.primaryColor
  const accentColor = brand.accentColor

  const deadlineBlock = deadline
    ? `<div style="background:${primaryColor}10;border-left:4px solid ${primaryColor};padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:13px;color:#666;">Prazo de conclusão</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${primaryColor};">${new Date(deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
        ${courseName ? `<p style="margin:4px 0 0;font-size:14px;color:#444;">${courseName}</p>` : ""}
      </div>`
    : ""

  // Convert line breaks to paragraphs
  const bodyHtml = body
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p style="margin:0 0 12px;line-height:1.6;color:#333;">${line}</p>`)
    .join("")

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:${primaryColor};border-radius:12px 12px 0 0;padding:24px 32px;text-align:center;">
      <h1 style="margin:0;font-size:18px;font-weight:700;color:#fff;letter-spacing:0.5px;">${brand.name} · Academy</h1>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1a1a1a;">${subject}</h2>

      ${deadlineBlock}

      ${bodyHtml}

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="margin:0;font-size:13px;color:#999;">Enviado por <strong>${senderName}</strong></p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px;font-size:11px;color:#999;">
      <p style="margin:0;">Powered by exímIA Academy</p>
    </div>
  </div>
</body>
</html>`
}
