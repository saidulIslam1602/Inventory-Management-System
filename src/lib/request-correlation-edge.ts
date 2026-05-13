/**
 * Edge-safe request correlation — used by `src/proxy.ts` only (no Node / Prisma).
 * Propagates `x-request-id` through middleware so Route Handlers / Server Actions can read it via `headers()`.
 */

import type { NextRequest } from "next/server";

export const REQUEST_ID_HEADER = "x-request-id";

export function resolveRequestId(req: NextRequest): string {
  const existing = req.headers.get(REQUEST_ID_HEADER)?.trim();
  return existing && existing.length > 0 ? existing : crypto.randomUUID();
}

/** Headers copy with correlation id set (forward into `NextResponse.next({ request })`). */
export function forwardHeadersWithRequestId(req: NextRequest, requestId: string): Headers {
  const h = new Headers(req.headers);
  h.set(REQUEST_ID_HEADER, requestId);
  return h;
}
