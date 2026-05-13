import { resolveUseSecureCookies } from "@/lib/auth-cookie-policy";

const KEYS = ["NODE_ENV", "NEXTAUTH_URL", "AUTH_URL"] as const;
const env = process.env as Record<string, string | undefined>;

describe("resolveUseSecureCookies", () => {
  let snapshot: Record<string, string | undefined>;

  beforeEach(() => {
    snapshot = {};
    for (const k of KEYS) snapshot[k] = env[k];
  });

  afterEach(() => {
    for (const k of KEYS) {
      const v = snapshot[k];
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  });

  test("development leaves undefined (Auth infers from request)", () => {
    env.NODE_ENV = "development";
    env.NEXTAUTH_URL = "http://localhost:3010";
    expect(resolveUseSecureCookies()).toBeUndefined();
  });

  test("development with test NODE_ENV same as dev", () => {
    env.NODE_ENV = "test";
    expect(resolveUseSecureCookies()).toBeUndefined();
  });

  test("production + https NEXTAUTH_URL → true", () => {
    env.NODE_ENV = "production";
    env.NEXTAUTH_URL = "https://ims.example.com";
    delete env.AUTH_URL;
    expect(resolveUseSecureCookies()).toBe(true);
  });

  test("production + https AUTH_URL when NEXTAUTH unset → true", () => {
    env.NODE_ENV = "production";
    delete env.NEXTAUTH_URL;
    env.AUTH_URL = "https://auth.example.com";
    expect(resolveUseSecureCookies()).toBe(true);
  });

  test("production + http localhost → false", () => {
    env.NODE_ENV = "production";
    env.NEXTAUTH_URL = "http://localhost:3020";
    expect(resolveUseSecureCookies()).toBe(false);
  });

  test("production + missing URL → undefined", () => {
    env.NODE_ENV = "production";
    delete env.NEXTAUTH_URL;
    delete env.AUTH_URL;
    expect(resolveUseSecureCookies()).toBeUndefined();
  });
});
