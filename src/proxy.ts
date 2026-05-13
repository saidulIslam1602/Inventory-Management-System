/**
 * Next.js 16+ request proxy (formerly `middleware.ts`) — route protection and RBAC.
 *
 * All /dashboard routes require authentication.
 * Role-based access is enforced per route group:
 *   /settings → ADMIN, MANAGER, VIEWER (STAFF redirected)
 *   /employees, /reports, /manager → STAFF blocked (redirect to /me)
 *   Mutation-only paths (inventory receive/edit/new, PO/project/customer create, etc.) → VIEWER blocked
 *   All listed prefixes → authentication required
 *
 * Unauthenticated users are redirected to /login.
 */

import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import {
  canAccessSettingsPage,
  staffBlockedPathname,
  viewerBlockedWritePathname,
} from "@/lib/rbac";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Keep this file free of Prisma/bcrypt — Node-only modules break the Edge bundle. */
const { auth: withAuth } = NextAuth(authConfig);

// Routes that require authentication (edge redirect before RSC; APIs use per-route auth())
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/me",
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

export default withAuth((req: NextRequest & { auth: { user?: { role?: string } } | null }) => {
  const { pathname } = req.nextUrl;

  // Check if the route needs protection
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  // Redirect unauthenticated users to login
  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce admin-only routes
  const role = req.auth.user.role;

  if (pathname.startsWith("/settings") && !canAccessSettingsPage(role)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (role === "STAFF" && staffBlockedPathname(pathname)) {
    return NextResponse.redirect(new URL("/me", req.url));
  }

  if (role === "VIEWER" && viewerBlockedWritePathname(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Run on all routes except static assets and API routes that handle auth themselves
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
