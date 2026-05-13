/**
 * Optional HTTPS canonicalisation for page navigations.
 * Only redirects when `x-forwarded-proto` is explicitly **`http`** and public URL env uses **`https:`**.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { REQUEST_ID_HEADER } from "@/lib/request-correlation-edge";

function configuredHttpsOrigin(): URL | null {
  const raw = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function observedForwardedProto(req: NextRequest): string | undefined {
  const xf = req.headers.get("x-forwarded-proto");
  if (xf) return xf.split(",")[0]?.trim().toLowerCase();
  return undefined;
}

/** Production-only 308 redirect HTTP → HTTPS for HTML navigations (TLS terminator forwards proto). */
export function maybeHttpsUpgradeRedirect(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (!configuredHttpsOrigin()) return null;

  if (observedForwardedProto(req) !== "http") return null;

  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host")?.trim();
  if (!host) return null;

  const lowerHost = host.toLowerCase();
  if (
    lowerHost.startsWith("localhost") ||
    lowerHost.startsWith("127.0.0.1") ||
    lowerHost.startsWith("[::1]")
  ) {
    return null;
  }

  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${host}`);
  const requestId = req.headers.get(REQUEST_ID_HEADER)?.trim() || crypto.randomUUID();
  const res = NextResponse.redirect(url, 308);
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}
