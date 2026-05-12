/**
 * Next.js 16+ request proxy (formerly `middleware.ts`) — route protection and RBAC.
 *
 * All /dashboard routes require authentication.
 * Role-based access is enforced per route group:
 *   /settings  → ADMIN only
 *   All other  → any authenticated user
 *
 * Unauthenticated users are redirected to /login.
 */

import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Keep this file free of Prisma/bcrypt — Node-only modules break the Edge bundle. */
const { auth: withAuth } = NextAuth(authConfig);

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inventory",
  "/purchase-orders",
  "/employees",
  "/projects",
  "/reports",
  "/settings",
];

// Routes restricted to ADMIN role only
const ADMIN_ONLY_PREFIXES = ["/settings/users"];

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
  const isAdminRoute = ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isAdminRoute && req.auth.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Run on all routes except static assets and API routes that handle auth themselves
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
