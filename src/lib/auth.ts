/**
 * Auth.js v5 (NextAuth) configuration.
 *
 * - Provider: credentials (email + bcrypt password)
 * - Session: JWT (Edge-compatible proxy; avoids Prisma/TCP on Edge)
 * - RBAC: role is copied into the JWT and session in `auth.config.ts`
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate shape of submitted credentials with Zod
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Look up the user by email
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            isActive: true,
          },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;

        // Constant-time password comparison
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
