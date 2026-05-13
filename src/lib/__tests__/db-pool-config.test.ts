import { pgPoolConfigFromEnv } from "@/lib/db-pool-config";

const env = process.env as Record<string, string | undefined>;

describe("pgPoolConfigFromEnv", () => {
  afterEach(() => {
    delete env.DATABASE_POOL_MAX;
    delete env.DATABASE_POOL_IDLE_MS;
    delete env.DATABASE_POOL_CONN_TIMEOUT_MS;
  });

  it("applies defaults", () => {
    const c = pgPoolConfigFromEnv("postgresql://localhost/db");
    expect(c.connectionString).toBe("postgresql://localhost/db");
    expect(c.max).toBe(10);
    expect(c.idleTimeoutMillis).toBe(30_000);
    expect(c.connectionTimeoutMillis).toBe(10_000);
  });

  it("reads optional env overrides", () => {
    env.DATABASE_POOL_MAX = "20";
    env.DATABASE_POOL_IDLE_MS = "5000";
    env.DATABASE_POOL_CONN_TIMEOUT_MS = "15000";
    const c = pgPoolConfigFromEnv("postgresql://localhost/db");
    expect(c.max).toBe(20);
    expect(c.idleTimeoutMillis).toBe(5000);
    expect(c.connectionTimeoutMillis).toBe(15_000);
  });

  it("ignores invalid numeric env", () => {
    env.DATABASE_POOL_MAX = "not-a-number";
    const c = pgPoolConfigFromEnv("postgresql://localhost/db");
    expect(c.max).toBe(10);
  });
});
