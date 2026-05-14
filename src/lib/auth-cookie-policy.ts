/**
 * Session cookie security for Auth.js — aligns `useSecureCookies` with the configured
 * public origin (`NEXTAUTH_URL` / `AUTH_URL`), not only with each request’s URL
 * (helps consistent behaviour behind TLS-terminating proxies when env is correct).
 *
 * @see https://authjs.dev/reference/core#usesecurecookies
 */

/** Public app URL used for Auth.js redirects / absolute URLs. */
function publicAuthUrl(): string | undefined {
  const u = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim();
  return u || undefined;
}

/** Origin only (`http://localhost:3010`) — for matching browser vs env in dev. */
export function publicAuthOrigin(): string | undefined {
  const raw = publicAuthUrl();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

/**
 * When `production`, returns whether session cookies must be `Secure` / `__Secure-` prefixed.
 * Returns `undefined` in non-production so Auth.js infers from the incoming request URL (typical local HTTP dev).
 */
export function resolveUseSecureCookies(): boolean | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;

  const raw = publicAuthUrl();
  if (!raw) return undefined;

  try {
    const u = new URL(raw);
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
      return false;
    }
    // Non-localhost HTTP in production should fail validate-production-env before traffic hits auth.
    return true;
  } catch {
    return undefined;
  }
}
