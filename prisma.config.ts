// Prisma v7 configuration file.
// Database URL is configured here (not in schema.prisma).
// See: https://pris.ly/d/config-datasource
//
// • **`DATABASE_DIRECT_URL`** — optional Postgres URL for **`prisma migrate`**, `db execute`, etc.
//   Use when **`DATABASE_URL`** points at a transaction pooler (PgBouncer, Neon pooler, …).
// • If unset, CLI falls back to **`DATABASE_URL`** (direct Compose / single-host setups).
//
// dotenv is optional: Docker/Compose and CI inject env vars; for local CLI runs use `dotenv-cli` or export vars.

import { defineConfig } from "prisma/config";

function migrateDatasourceUrl(): string {
  return (
    process.env["DATABASE_DIRECT_URL"]?.trim() ||
    process.env["DATABASE_URL"]?.trim() ||
    "postgresql://aqila_user:aqila_dev_secret@localhost:15432/aqila_ims"
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrateDatasourceUrl(),
  },
});
