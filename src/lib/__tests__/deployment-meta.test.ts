import { getDeploymentRevision } from "@/lib/deployment-meta";

const env = process.env as Record<string, string | undefined>;

describe("getDeploymentRevision", () => {
  const keys = [
    "APP_VERSION",
    "VERCEL_GIT_COMMIT_SHA",
    "GITHUB_SHA",
    "K_REVISION",
    "SOURCE_VERSION",
  ] as const;

  let snapshot: Record<string, string | undefined>;

  beforeEach(() => {
    snapshot = {};
    for (const k of keys) snapshot[k] = env[k];
    for (const k of keys) delete env[k];
  });

  afterEach(() => {
    for (const k of keys) {
      const v = snapshot[k];
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  });

  test("undefined when nothing set", () => {
    expect(getDeploymentRevision()).toBeUndefined();
  });

  test("prefers APP_VERSION over others", () => {
    env.APP_VERSION = "v1.0.0";
    env.GITHUB_SHA = "abc";
    expect(getDeploymentRevision()).toBe("v1.0.0");
  });

  test("falls back to GITHUB_SHA", () => {
    env.GITHUB_SHA = "deadbeef";
    expect(getDeploymentRevision()).toBe("deadbeef");
  });
});
