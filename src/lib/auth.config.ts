/**
 * Edge-safe Auth.js configuration (no Prisma, bcrypt, or other Node-only imports).
 * Used by `proxy.ts` (Next.js 16+). Must stay free of Node built-ins for the Edge bundle.
 *
 * Session data lives in a signed JWT; full sign-in still runs in `auth.ts` with credentials + DB.
 *
 * HTTPS / reverse proxies / cookie flags: docs/https-and-cookies.md
 */

import type { NextAuthConfig } from "next-auth";

export default {
  // Required when the app is reached via localhost, Docker port mapping, or proxies
  // (otherwise Auth.js throws UntrustedHost, surfaced as ?error=Configuration on /login).
  trustHost: true,

  providers: [],

  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user, trigger, session: updateSession }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword === true;
      }
      if (
        trigger === "update" &&
        updateSession &&
        typeof updateSession === "object" &&
        "mustChangePassword" in updateSession
      ) {
        token.mustChangePassword = Boolean(
          (updateSession as { mustChangePassword?: boolean }).mustChangePassword
        );
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as import("@prisma/client").UserRole;
        session.user.mustChangePassword = token.mustChangePassword === true;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
