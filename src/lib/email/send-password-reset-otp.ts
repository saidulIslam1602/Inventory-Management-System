import { getDigestMailTransport } from "./nodemailer-transport";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendPasswordResetOtpEmail(params: {
  to: string;
  code: string;
  minutesValid: number;
}): Promise<void> {
  const transport = getDigestMailTransport();
  if (!transport) {
    throw new Error("SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }

  const from =
    process.env.SMTP_FROM?.trim() || `Aqila IMS <noreply@${process.env.SMTP_HOST ?? "localhost"}>`;

  const spaced = params.code.split("").join(" ");
  const text = [
    "You requested a password reset for Aqila IMS.",
    "",
    `Your verification code: ${params.code}`,
    "",
    `This code expires in ${params.minutesValid} minutes. If you did not request this, you can ignore this email.`,
  ].join("\n");

  await transport.sendMail({
    from,
    to: params.to,
    subject: "Aqila IMS — password reset code",
    text,
    html: `<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">You requested a password reset for <strong>Aqila IMS</strong>.</p>
<p style="font-family:ui-monospace,monospace;font-size:20px;font-weight:600;letter-spacing:0.2em">${escapeHtml(spaced)}</p>
<p style="font-family:system-ui,sans-serif;font-size:13px;color:#555">This code expires in <strong>${escapeHtml(String(params.minutesValid))}</strong> minutes. If you did not request a reset, you can ignore this email.</p>`,
  });
}
