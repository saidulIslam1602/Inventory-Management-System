import nodemailer from "nodemailer";

/** True when env has minimum settings to send transactional mail (digest, etc.). */
export function isDigestEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()
  );
}

export function getDigestMailTransport(): nodemailer.Transporter | null {
  if (!isDigestEmailConfigured()) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true";
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}
