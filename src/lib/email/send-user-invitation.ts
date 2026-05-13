import { getDigestMailTransport } from "./nodemailer-transport";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendUserInvitationEmail(params: {
  to: string;
  inviteUrl: string;
  roleLabel: string;
  expiresInDays: number;
}): Promise<void> {
  const transport = getDigestMailTransport();
  if (!transport) {
    throw new Error("SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }

  const from =
    process.env.SMTP_FROM?.trim() || `Aqila IMS <noreply@${process.env.SMTP_HOST ?? "localhost"}>`;

  const text = [
    "You have been invited to Aqila IMS.",
    "",
    `Role: ${params.roleLabel}`,
    "",
    `Open this link to create your password (expires in ${params.expiresInDays} days):`,
    params.inviteUrl,
    "",
    "If you did not expect this invitation, you can ignore this email.",
  ].join("\n");

  await transport.sendMail({
    from,
    to: params.to,
    subject: "Aqila IMS — your invitation",
    text,
    html: `<p style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">You have been invited to <strong>Aqila IMS</strong> as <strong>${escapeHtml(params.roleLabel)}</strong>.</p>
<p style="font-family:system-ui,sans-serif;font-size:14px"><a href="${escapeHtml(params.inviteUrl)}" style="color:#2563eb">Accept invitation</a></p>
<p style="font-family:system-ui,sans-serif;font-size:13px;color:#555">This link expires in <strong>${escapeHtml(String(params.expiresInDays))}</strong> days. If you did not expect this, you can ignore this email.</p>`,
  });
}
