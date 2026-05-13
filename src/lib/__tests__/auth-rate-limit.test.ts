import type { NextRequest } from "next/server";
import { checkAuthRoutePostRateLimit } from "@/lib/auth-rate-limit";

describe("checkAuthRoutePostRateLimit", () => {
  function req(pathname: string, ip: string): NextRequest {
    const nextUrl = new URL(`http://localhost:3000${pathname}`);
    return {
      headers: new Headers({ "x-forwarded-for": ip }),
      nextUrl,
    } as NextRequest;
  }

  it("applies stricter bucket for credential callback path", async () => {
    const storeIp = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
    const pathname = "/api/auth/callback/credentials";

    for (let i = 0; i < 15; i++) {
      expect(await checkAuthRoutePostRateLimit(req(pathname, storeIp))).toBeNull();
    }
    const block = await checkAuthRoutePostRateLimit(req(pathname, storeIp));
    expect(block).not.toBeNull();
    expect(block!.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("uses separate bucket for non-credential auth POST", async () => {
    const storeIp = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
    const pathname = "/api/auth/signout";

    expect(await checkAuthRoutePostRateLimit(req(pathname, storeIp))).toBeNull();
  });
});
