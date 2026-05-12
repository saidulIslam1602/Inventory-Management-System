// Prisma v7 configuration file.
// Database URL is configured here (not in schema.prisma).
// See: https://pris.ly/d/config-datasource
//
// dotenv is optional: Docker/Compose and CI inject DATABASE_URL; for local CLI runs use `dotenv-cli` or export vars.

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env["DATABASE_URL"] ??
      "postgresql://aqila_user:aqila_dev_secret@localhost:15432/aqila_ims",
  },
});
