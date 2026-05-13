/**
 * Prisma client singleton.
 *
 * In development, a global variable prevents creating a new client on every
 * hot-reload (which would exhaust the PostgreSQL connection pool quickly).
 * In production, a single module-level instance is used.
 *
 * Prisma v7 reads the DATABASE_URL from the environment automatically
 * via the prisma.config.ts datasource configuration.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Local-only default for docker-compose; never used when NODE_ENV is production. */
const DEV_DATABASE_URL_FALLBACK =
  "postgresql://aqila_user:aqila_dev_secret@localhost:15432/aqila_ims";

function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL must be set in production. Configure the Postgres connection in the environment."
    );
  }
  return DEV_DATABASE_URL_FALLBACK;
}

const connectionString = resolveDatabaseUrl();

/** Explicit `PrismaClient` so consumers (including `prisma/seed.ts`) resolve full model delegates. */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
