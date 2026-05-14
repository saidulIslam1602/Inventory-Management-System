/**
 * HTTP security headers applied via `next.config.ts` (`headers()`).
 *
 * Production adds CSP + HSTS; development skips CSP/HSTS so Turbopack/HMR and http://localhost keep working.
 */

const IMG_HOSTS = ["https://elproffen-cdn.imgix.net", "https://www.aqila.no"] as const;

function productionContentSecurityPolicy(): string {
  const imgSrc = ["'self'", "data:", "blob:", ...IMG_HOSTS].join(" ");
  const directives = [
    "default-src 'self'",
    /** Next.js + hydration; tighten later (nonces / hashes) per staging reports */
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    /** Recharts theme injection (`chart.tsx` inline `<style>`) */
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    /** Same-origin API, RSC, `/_next/image`, service worker fetches */
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    /** Same-origin embeds only */
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

/** Header entries merged into Next `headers()` config (path `/:path*`). */
export function securityHeaderPairs(): { key: string; value: string }[] {
  const isProd = process.env.NODE_ENV === "production";

  const baseline: { key: string; value: string }[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    {
      key: "Permissions-Policy",
      value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];

  if (!isProd) {
    return baseline;
  }

  return [
    ...baseline,
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
    {
      key: "Content-Security-Policy",
      value: productionContentSecurityPolicy(),
    },
  ];
}
