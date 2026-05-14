/**
 * Auth.js v5 — catch-all API route handler.
 * Handles sign-in, sign-out, CSRF, and session management endpoints.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { checkAuthRoutePostRateLimit } from "@/lib/auth-rate-limit";

const { GET: authGET, POST: authPOST } = handlers;

export const GET = authGET;

export async function POST(req: NextRequest) {
  const block = await checkAuthRoutePostRateLimit(req);
  if (block) {
    /**
     * next-auth/react `signIn(..., { redirect: false })` always parses `data.url`;
     * include it so clients don't throw on 429.
     */
    const redirectUrl = new URL("/login", req.nextUrl.origin);
    redirectUrl.searchParams.set("error", "RateLimited");
    return NextResponse.json(
      { url: redirectUrl.toString() },
      {
        status: 429,
        headers: { "Retry-After": String(block.retryAfterSeconds) },
      }
    );
  }

  return authPOST(req);
}
