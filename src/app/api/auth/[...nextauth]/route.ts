/**
 * Auth.js v5 — catch-all API route handler.
 * Handles sign-in, sign-out, CSRF, and session management endpoints.
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
