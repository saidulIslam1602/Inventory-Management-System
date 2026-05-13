import type { NextRequest } from "next/server";
import { consumeAuthRateLimit } from "@/lib/auth-rate-limit-backend";
import { getClientIpFromHeaders } from "@/lib/client-ip";

const STORE_CREDENTIALS = "auth:credentials_post";
const STORE_AUTH_POST = "auth:other_post";

const STORE_FORGOT = "auth:forgot_password";
const STORE_RESET_OTP = "auth:reset_password_otp";
const STORE_INVITE_ACCEPT = "auth:invite_accept";
const STORE_INVITE_CREATE = "auth:invite_create";

/** Credential POST — brute-force protection */
const CREDENTIALS_LIMIT = 15;
const CREDENTIALS_WINDOW_MS = 15 * 60 * 1000;

/** Other Auth.js POST (sign-out, etc.) */
const AUTH_OTHER_POST_LIMIT = 120;
const AUTH_OTHER_POST_WINDOW_MS = 15 * 60 * 1000;

const FORGOT_PASSWORD_LIMIT = 10;
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;

const RESET_OTP_LIMIT = 25;
const RESET_OTP_WINDOW_MS = 15 * 60 * 1000;

const INVITE_ACCEPT_LIMIT = 15;
const INVITE_ACCEPT_WINDOW_MS = 15 * 60 * 1000;

const INVITE_CREATE_LIMIT = 40;
const INVITE_CREATE_WINDOW_MS = 60 * 60 * 1000;

export type RateLimitBlock = { retryAfterSeconds: number };

export function rateLimitedActionMessage(block: RateLimitBlock): string {
  const m = Math.ceil(block.retryAfterSeconds / 60);
  if (block.retryAfterSeconds < 90) {
    return "Too many attempts from this network. Try again in about a minute.";
  }
  return `Too many attempts from this network. Try again in about ${m} minutes.`;
}

function toBlock(
  outcome: { ok: true } | { ok: false; retryAfterSeconds: number }
): RateLimitBlock | null {
  return outcome.ok ? null : { retryAfterSeconds: outcome.retryAfterSeconds };
}

/**
 * Auth route POST handler — returns block info when limited.
 * NextAuth credentials flow hits `/api/auth/callback/credentials`.
 */
export async function checkAuthRoutePostRateLimit(
  req: NextRequest
): Promise<RateLimitBlock | null> {
  const ip = getClientIpFromHeaders(req.headers);
  const pathname = req.nextUrl.pathname;
  const isCredentialsCallback =
    pathname.includes("/callback/credentials") || pathname.endsWith("/callback/credentials");

  if (isCredentialsCallback) {
    const r = await consumeAuthRateLimit({
      store: STORE_CREDENTIALS,
      key: ip,
      limit: CREDENTIALS_LIMIT,
      windowMs: CREDENTIALS_WINDOW_MS,
    });
    return toBlock(r);
  }

  const r = await consumeAuthRateLimit({
    store: STORE_AUTH_POST,
    key: ip,
    limit: AUTH_OTHER_POST_LIMIT,
    windowMs: AUTH_OTHER_POST_WINDOW_MS,
  });
  return toBlock(r);
}

export async function checkForgotPasswordRateLimit(h: Headers): Promise<RateLimitBlock | null> {
  const ip = getClientIpFromHeaders(h);
  const r = await consumeAuthRateLimit({
    store: STORE_FORGOT,
    key: ip,
    limit: FORGOT_PASSWORD_LIMIT,
    windowMs: FORGOT_PASSWORD_WINDOW_MS,
  });
  return toBlock(r);
}

export async function checkResetPasswordOtpRateLimit(h: Headers): Promise<RateLimitBlock | null> {
  const ip = getClientIpFromHeaders(h);
  const r = await consumeAuthRateLimit({
    store: STORE_RESET_OTP,
    key: ip,
    limit: RESET_OTP_LIMIT,
    windowMs: RESET_OTP_WINDOW_MS,
  });
  return toBlock(r);
}

export async function checkInviteAcceptRateLimit(h: Headers): Promise<RateLimitBlock | null> {
  const ip = getClientIpFromHeaders(h);
  const r = await consumeAuthRateLimit({
    store: STORE_INVITE_ACCEPT,
    key: ip,
    limit: INVITE_ACCEPT_LIMIT,
    windowMs: INVITE_ACCEPT_WINDOW_MS,
  });
  return toBlock(r);
}

export async function checkInviteCreateRateLimit(h: Headers): Promise<RateLimitBlock | null> {
  const ip = getClientIpFromHeaders(h);
  const r = await consumeAuthRateLimit({
    store: STORE_INVITE_CREATE,
    key: ip,
    limit: INVITE_CREATE_LIMIT,
    windowMs: INVITE_CREATE_WINDOW_MS,
  });
  return toBlock(r);
}
