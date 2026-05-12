"use server";

/**
 * Auth server actions — sign-out must run on the server in Auth.js v5
 * for reliable cookie invalidation and redirects.
 */

import { signOut } from "@/lib/auth";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
