import { getClientIpFromHeaders } from "@/lib/client-ip";

describe("getClientIpFromHeaders", () => {
  it("uses first x-forwarded-for hop", () => {
    const h = new Headers({
      "x-forwarded-for": "203.0.113.4, 10.0.0.1",
    });
    expect(getClientIpFromHeaders(h)).toBe("203.0.113.4");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.2" });
    expect(getClientIpFromHeaders(h)).toBe("198.51.100.2");
  });

  it("returns unknown when absent", () => {
    expect(getClientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
