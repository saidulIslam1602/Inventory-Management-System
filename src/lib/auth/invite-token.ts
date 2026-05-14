import { createHash, randomBytes } from "node:crypto";

function pepper(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

export function generateInviteTokenRaw(): string {
  return randomBytes(32).toString("base64url");
}

/** Persist only this; never store the raw URL token. */
export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(`${pepper()}:invite:${raw}`).digest("hex");
}

export function maskEmailNorm(emailNorm: string): string {
  const at = emailNorm.indexOf("@");
  if (at < 1) return "***";
  const local = emailNorm.slice(0, at);
  const domain = emailNorm.slice(at + 1);
  const show = local.slice(0, 1);
  return `${show}***@${domain}`;
}
