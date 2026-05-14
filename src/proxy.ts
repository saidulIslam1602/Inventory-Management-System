/**
 * Next.js 16+ request proxy (formerly `middleware.ts`) — correlation id, route protection, RBAC.
 *
 * Request correlation:
 * - Sets/propagates `x-request-id` on **all** matched routes (including `/api/*`).
 * - API routes get headers only; they do **not** run `withAuth` (handlers still call `auth()`).
 *
 * Role-based access is enforced per route group for pages:
 *   /settings → ADMIN, MANAGER, VIEWER (STAFF redirected)
 *   /employees, /reports, /manager → STAFF blocked (redirect to /me)
 *   /manager → VIEWER blocked (redirect to /dashboard)
 *   /reports → VIEWER blocked (redirect to /dashboard)
 *   Mutation-only paths → VIEWER blocked
 *
 * Unauthenticated users are redirected to /login.
 * Users with mustChangePassword may only use /change-password (plus auth API routes) until they update.
 */

import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import {
  REQUEST_ID_HEADER,
  forwardHeadersWithRequestId,
  resolveRequestId,
} from "@/lib/request-correlation-edge";
import { maybeHttpsUpgradeRedirect } from "@/lib/https-upgrade";
import {
  canAccessSettingsPage,
  staffBlockedPathname,
  viewerBlockedManagerHubPathname,
  viewerBlockedReportsPathname,
  viewerBlockedWritePathname,
} from "@/lib/rbac";
import { NextResponse, NextRequest } from "next/server";
import type { NextFetchEvent, NextMiddleware } from "next/server";

/** Keep Prisma/bcrypt out — Edge bundle. */
const { auth: withAuth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/me",
  "/profile",
  "/manager",
  "/inventory",
  "/purchase-orders",
  "/suppliers",
  "/employees",
  "/projects",
  "/customers",
  "/reports",
  "/settings",
];

type AuthedUser = { role?: string; mustChangePassword?: boolean };

function rbacRedirect(req: NextRequest & { auth: { user?: AuthedUser } | null }) {
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

  const attach = (res: NextResponse) => {
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  };

  const nextWithCorrelation = () =>
    attach(
      NextResponse.next({
        request: { headers: forwardHeadersWithRequestId(req, requestId) },
      })
    );

  const redirectWithCorrelation = (url: URL) => attach(NextResponse.redirect(url));

  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const mustChange = user?.mustChangePassword === true;

  const isChangePassword = pathname.startsWith("/change-password");
  const isPublicAuthPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/invite");

  if (isChangePassword) {
    if (!user) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", "/change-password");
      return redirectWithCorrelation(loginUrl);
    }
    return nextWithCorrelation();
  }

  if (mustChange && isPublicAuthPath) {
    return redirectWithCorrelation(new URL("/change-password", req.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) {
    return nextWithCorrelation();
  }

  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return redirectWithCorrelation(loginUrl);
  }

  if (mustChange) {
    return redirectWithCorrelation(new URL("/change-password", req.url));
  }

  const role = user.role;

  if (pathname.startsWith("/settings") && !canAccessSettingsPage(role)) {
    return redirectWithCorrelation(new URL("/dashboard", req.url));
  }

  if (
    (pathname.startsWith("/settings/audit-log") || pathname.startsWith("/settings/data-quality")) &&
    role !== "ADMIN"
  ) {
    return redirectWithCorrelation(new URL("/settings", req.url));
  }

  if (role === "STAFF" && staffBlockedPathname(pathname)) {
    return redirectWithCorrelation(new URL("/me", req.url));
  }

  if (role === "VIEWER" && viewerBlockedManagerHubPathname(pathname)) {
    return redirectWithCorrelation(new URL("/dashboard", req.url));
  }

  if (role === "VIEWER" && viewerBlockedReportsPathname(pathname)) {
    return redirectWithCorrelation(new URL("/dashboard", req.url));
  }

  if (role === "VIEWER" && viewerBlockedWritePathname(pathname)) {
    return redirectWithCorrelation(new URL("/dashboard", req.url));
  }

  return nextWithCorrelation();
}

const rbacMiddleware = withAuth(rbacRedirect);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const requestId = resolveRequestId(req);
  const requestHeaders = forwardHeadersWithRequestId(req, requestId);

  if (req.nextUrl.pathname.startsWith("/api/")) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  }

  const httpsRedirect = maybeHttpsUpgradeRedirect(req);
  if (httpsRedirect) return httpsRedirect;

  const reqForRbac = new NextRequest(req, { headers: requestHeaders });
  // NextAuth `auth()` overload typings target route handlers; middleware runtime matches NextMiddleware.
  return (rbacMiddleware as unknown as NextMiddleware)(reqForRbac, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
