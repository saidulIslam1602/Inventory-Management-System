/**
 * Fail fast on misconfigured production deployments (secrets & public URL).
 * Invoked from `src/instrumentation.ts` on Node.js runtime startup.
 */

import { MIN_CRON_SECRET_LENGTH } from "@/lib/cron-auth";

function publicAppUrl(): string | undefined {
  const u = process.env.NEXTAUTH_URL?.trim() || process.env.AUTH_URL?.trim();
  return u || undefined;
}

/** True when URL uses http against localhost / loopback only (smoke tests). */
function isAllowlistedInsecureLocal(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "http:") return false;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function assertProductionOtlpEndpoint(): void {
  if (process.env.OTEL_ENABLED !== "true") return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error(
      "[production] OTEL_ENABLED=true requires OTEL_EXPORTER_OTLP_ENDPOINT (your collector OTLP HTTP traces URL). See docs/application-observability.md."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error(
      "[production] OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL. See docs/application-observability.md."
    );
  }

  const host = parsed.hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  if (parsed.protocol === "http:" && !local) {
    throw new Error(
      "[production] OTLP endpoint must use https:// unless targeting localhost/127.0.0.1. See docs/application-observability.md."
    );
  }
}

/**
 * Throws with an actionable message when required production variables are missing or weak.
 * No-op when `NODE_ENV !== "production"`.
 */
export function assertProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") return;

  const authSecret = process.env.AUTH_SECRET?.trim();
  if (!authSecret || authSecret.length < 32) {
    throw new Error(
      "[production] AUTH_SECRET must be set and at least 32 characters (e.g. openssl rand -base64 32). See docs/secrets-and-config.md."
    );
  }

  const appUrl = publicAppUrl();
  if (!appUrl) {
    throw new Error(
      "[production] Set NEXTAUTH_URL or AUTH_URL to the app’s public origin (HTTPS). See docs/secrets-and-config.md."
    );
  }

  if (!/^https:\/\//i.test(appUrl) && !isAllowlistedInsecureLocal(appUrl)) {
    throw new Error(
      "[production] NEXTAUTH_URL / AUTH_URL must use https:// except http://localhost or http://127.0.0.1 for local smoke tests. See docs/secrets-and-config.md."
    );
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && cronSecret.length < MIN_CRON_SECRET_LENGTH) {
    throw new Error(
      `[production] When set, CRON_SECRET must be at least ${MIN_CRON_SECRET_LENGTH} characters (scheduler bearer token). See docs/secrets-and-config.md.`
    );
  }

  assertProductionOtlpEndpoint();
}
