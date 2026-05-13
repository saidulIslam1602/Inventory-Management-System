import type { PoolConfig } from "pg";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Default concurrent connections per Node process (tune vs Postgres `max_connections`). */
const DEFAULT_POOL_MAX = 10;

/**
 * `pg.Pool` options for Prisma’s `@prisma/adapter-pg` driver.
 *
 * Env:
 * - `DATABASE_POOL_MAX` — pool size per process (default `10`)
 * - `DATABASE_POOL_IDLE_MS` — `idleTimeoutMillis` (default `30000`)
 * - `DATABASE_POOL_CONN_TIMEOUT_MS` — `connectionTimeoutMillis` (default `10000`)
 */
export function pgPoolConfigFromEnv(connectionString: string): PoolConfig {
  return {
    connectionString,
    max: envInt("DATABASE_POOL_MAX", DEFAULT_POOL_MAX),
    idleTimeoutMillis: envInt("DATABASE_POOL_IDLE_MS", 30_000),
    connectionTimeoutMillis: envInt("DATABASE_POOL_CONN_TIMEOUT_MS", 10_000),
  };
}
