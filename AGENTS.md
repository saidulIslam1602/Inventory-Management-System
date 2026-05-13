<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Database migrations (Prisma)

- **Node.js:** Prisma 7.x expects **Node 22+** (see `package.json` `engines` and `.nvmrc`). On **Node 18**, raw `npx prisma …` can crash with `ERR_REQUIRE_ESM` / `zeptomatch`; use **`npm run db:migrate:deploy`** / other `db:*` scripts (they set `NODE_OPTIONS=--experimental-require-module`), or upgrade Node.
- **New empty database:** run `npm run db:migrate:deploy` (or `npx prisma migrate deploy`). The single migration `20250512120000_init_baseline` creates the full schema from zero.
- **Existing database that already matches `schema.prisma` but has no / different migration history:** do **not** run deploy blindly (DDL may conflict). Mark the baseline as already applied:  
  `npx prisma migrate resolve --applied 20250512120000_init_baseline`  
  Remove any orphan rows in `_prisma_migrations` for migration names that no longer exist in `prisma/migrations/`.
- **Ongoing changes:** add new migrations with `npx prisma migrate dev --name <meaningful_name>` and deploy with `db:migrate:deploy`. Avoid `db push` on production-like databases.
- **Local reset:** `npx prisma migrate reset` reapplies all migrations from scratch (destructive; development only).

Portal / ops backlog: [docs/portal-high-impact.md](docs/portal-high-impact.md) (done vs next).
