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

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://aqila_user:aqila_dev_secret@localhost:15432/aqila_ims";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
