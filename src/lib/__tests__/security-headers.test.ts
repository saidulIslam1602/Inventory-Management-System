import { securityHeaderPairs } from "@/lib/security-headers";

describe("securityHeaderPairs", () => {
  const env = process.env as Record<string, string | undefined>;

  afterEach(() => {
    env.NODE_ENV = "test";
  });

  it("always applies baseline headers without CSP/HSTS in non-production", () => {
    env.NODE_ENV = "development";
    const pairs = securityHeaderPairs();
    const keys = pairs.map((p) => p.key);
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("Permissions-Policy");
    expect(keys).toContain("Cross-Origin-Opener-Policy");
    expect(keys).not.toContain("Content-Security-Policy");
    expect(keys).not.toContain("Strict-Transport-Security");
  });

  it("adds CSP and HSTS in production", () => {
    env.NODE_ENV = "production";
    const pairs = securityHeaderPairs();
    const keys = pairs.map((p) => p.key);
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("Content-Security-Policy");
    const csp = pairs.find((p) => p.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("elproffen-cdn.imgix.net");
    expect(csp).toContain("www.aqila.no");
  });
});
