/**
 * Rate limiting for authenticated API routes (search, documents, etc.).
 * Reuses the same Upstash/memory backend as auth rate limits.
 */

import { NextRequest, NextResponse } from "next/server";
import { consumeAuthRateLimit } from "@/lib/auth-rate-limit-backend";
import { getClientIpFromHeaders } from "@/lib/client-ip";

export interface ApiRateLimitConfig {
  /** Sliding window request limit */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Unique store name, e.g. "api:search" */
  store: string;
}

/**
 * Returns a 429 NextResponse if the caller is over the limit, or null if they are allowed.
 * Call at the top of route handlers after auth().
 */
export async function checkApiRateLimit(
  req: NextRequest,
  config: ApiRateLimitConfig
): Promise<NextResponse | null> {
  const ip = getClientIpFromHeaders(req.headers);
  const outcome = await consumeAuthRateLimit({
    store: config.store,
    key: ip,
    limit: config.limit,
    windowMs: config.windowMs,
  });
  if (outcome.ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again." },
    {
      status: 429,
      headers: { "Retry-After": String(outcome.retryAfterSeconds) },
    }
  );
}
