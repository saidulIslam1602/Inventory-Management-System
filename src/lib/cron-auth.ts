import { createHash, timingSafeEqual } from "node:crypto";
import { getClientIpFromHeaders } from "@/lib/client-ip";

/** Enforced in production when `CRON_SECRET` is non-empty (see `validate-production-env`). */
export const MIN_CRON_SECRET_LENGTH = 24;

export type CronAuthFailure =
  | { kind: "not_configured" }
  | { kind: "unauthorized" }
  | { kind: "forbidden_ip" };

function parseIpAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function bearerCredentials(authorization: string | null): string | undefined {
  if (!authorization) return undefined;
  const m = /^Bearer\s+(\S+)/i.exec(authorization.trim());
  return m?.[1];
}

/** Compare secrets without leaking length via `timingSafeEqual` on UTF-8 bytes. */
function secretSha256Equal(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/** Subset of Web `Request` — avoids relying on global `Request` in tests. */
export type CronRequestLike = { headers: Headers };

/**
 * Authorize a cron HTTP request: `Authorization: Bearer <CRON_SECRET>` plus optional IP allowlist.
 * IP check uses `x-forwarded-for` (first hop) / `x-real-ip` — trust only when your edge sets them honestly.
 */
export function authorizeCronRequest(req: CronRequestLike): CronAuthFailure | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return { kind: "not_configured" };
  }

  const allowIps = parseIpAllowlist(process.env.CRON_ALLOWED_IPS);
  if (allowIps.length > 0) {
    const ip = getClientIpFromHeaders(new Headers(req.headers));
    if (ip === "unknown" || !allowIps.includes(ip)) {
      return { kind: "forbidden_ip" };
    }
  }

  const token = bearerCredentials(req.headers.get("authorization"));
  if (!token || !secretSha256Equal(token, secret)) {
    return { kind: "unauthorized" };
  }

  return null;
}
