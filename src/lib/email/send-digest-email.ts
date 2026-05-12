import { getDigestMailTransport } from "./nodemailer-transport";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendDigestEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const transport = getDigestMailTransport();
  if (!transport) {
    throw new Error("SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }

  const from =
    process.env.SMTP_FROM?.trim() || `Aqila IMS <noreply@${process.env.SMTP_HOST ?? "localhost"}>`;

  await transport.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: `<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">Daily ops digest (plain text below).</p><pre style="font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap;word-break:break-word">${escapeHtml(params.text)}</pre>`,
  });
}
