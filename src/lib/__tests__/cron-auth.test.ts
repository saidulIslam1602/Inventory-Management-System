import {
  authorizeCronRequest,
  MIN_CRON_SECRET_LENGTH,
  type CronRequestLike,
} from "@/lib/cron-auth";

const env = process.env as Record<string, string | undefined>;

describe("authorizeCronRequest", () => {
  let prevCron: string | undefined;
  let prevAllow: string | undefined;

  beforeEach(() => {
    prevCron = env.CRON_SECRET;
    prevAllow = env.CRON_ALLOWED_IPS;
    env.CRON_SECRET = "a".repeat(MIN_CRON_SECRET_LENGTH);
    delete env.CRON_ALLOWED_IPS;
  });

  afterEach(() => {
    if (prevCron === undefined) delete env.CRON_SECRET;
    else env.CRON_SECRET = prevCron;
    if (prevAllow === undefined) delete env.CRON_ALLOWED_IPS;
    else env.CRON_ALLOWED_IPS = prevAllow;
  });

  function req(headers: Record<string, string>): CronRequestLike {
    return { headers: new Headers(headers) };
  }

  it("returns not_configured when CRON_SECRET unset", () => {
    delete env.CRON_SECRET;
    expect(authorizeCronRequest(req({ authorization: "Bearer x" }))?.kind).toBe("not_configured");
  });

  it("returns unauthorized when Authorization missing", () => {
    expect(authorizeCronRequest(req({}))?.kind).toBe("unauthorized");
  });

  it("returns unauthorized when Bearer token wrong", () => {
    expect(
      authorizeCronRequest(req({ authorization: `Bearer ${"b".repeat(MIN_CRON_SECRET_LENGTH)}` }))
        ?.kind
    ).toBe("unauthorized");
  });

  it("allows valid Bearer token", () => {
    expect(
      authorizeCronRequest(req({ authorization: `Bearer ${"a".repeat(MIN_CRON_SECRET_LENGTH)}` }))
    ).toBeNull();
  });

  it("returns forbidden_ip when allowlist set and IP not listed", () => {
    env.CRON_ALLOWED_IPS = "203.0.113.5, 198.51.100.2";
    expect(
      authorizeCronRequest(
        req({
          authorization: `Bearer ${"a".repeat(MIN_CRON_SECRET_LENGTH)}`,
          "x-forwarded-for": "203.0.113.99",
        })
      )?.kind
    ).toBe("forbidden_ip");
  });

  it("allows IP when listed", () => {
    env.CRON_ALLOWED_IPS = "203.0.113.5";
    expect(
      authorizeCronRequest(
        req({
          authorization: `Bearer ${"a".repeat(MIN_CRON_SECRET_LENGTH)}`,
          "x-forwarded-for": "203.0.113.5",
        })
      )
    ).toBeNull();
  });

  it("denies unknown client IP when allowlist is non-empty", () => {
    env.CRON_ALLOWED_IPS = "203.0.113.5";
    expect(
      authorizeCronRequest(
        req({
          authorization: `Bearer ${"a".repeat(MIN_CRON_SECRET_LENGTH)}`,
        })
      )?.kind
    ).toBe("forbidden_ip");
  });
});
