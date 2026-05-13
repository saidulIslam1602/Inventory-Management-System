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
 * Users with mustChangePassword may only use /change-password (plus auth API routes) until they update.
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

export default withAuth((req: NextRequest & { auth: { user?: AuthedUser } | null }) => {
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
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (mustChange && isPublicAuthPath) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (mustChange) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  const role = user.role;

  if (pathname.startsWith("/settings") && !canAccessSettingsPage(role)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    (pathname.startsWith("/settings/audit-log") || pathname.startsWith("/settings/data-quality")) &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/settings", req.url));
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
