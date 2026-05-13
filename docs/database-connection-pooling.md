# Database connection pooling — Aqila IMS

PostgreSQL has a hard **`max_connections`** budget. Each Node.js process running this app opens a **`pg.Pool`** (via `@prisma/adapter-pg`). Without a pooler or conservative limits, horizontal scaling or multiple workers can exhaust Postgres.

**Canonical env templates:** [`.env.example`](../.env.example). **Secrets discipline:** [`secrets-and-config.md`](./secrets-and-config.md). **Production checklist:** [`production-readiness.md`](./production-readiness.md) tracker **12**. **Query/index posture:** [`database-performance.md`](./database-performance.md) tracker **16**.

---

## Runtime vs migrations

| Concern                                             | Env                                                       | Used by                                   |
| --------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| **App queries** (Next.js, seed via `src/lib/db.ts`) | **`DATABASE_URL`**                                        | Prisma client + `pg.Pool`                 |
| **Migrations / CLI** (`migrate deploy`, etc.)       | **`DATABASE_DIRECT_URL`** if set, else **`DATABASE_URL`** | [`prisma.config.ts`](../prisma.config.ts) |

When using a **transaction-mode pooler** (many hosted “pooler” URLs), DDL and some migration patterns expect a **direct** session to Postgres. Set:

- **`DATABASE_URL`** → pooler URL (port often `6432`, `6543`, or provider-specific host)
- **`DATABASE_DIRECT_URL`** → primary Postgres URL (port `5432` or provider “direct” host)

Docker Compose and single-host Postgres typically use **one** URL: set **`DATABASE_URL`** only.

---

## App-side pool knobs

Configured in [`src/lib/db-pool-config.ts`](../src/lib/db-pool-config.ts):

| Variable                            | Default | Meaning                              |
| ----------------------------------- | ------- | ------------------------------------ |
| **`DATABASE_POOL_MAX`**             | `10`    | Max connections **per Node process** |
| **`DATABASE_POOL_IDLE_MS`**         | `30000` | `idleTimeoutMillis`                  |
| **`DATABASE_POOL_CONN_TIMEOUT_MS`** | `10000` | `connectionTimeoutMillis`            |

**Capacity sketch:**  
`(app replicas or instances) × DATABASE_POOL_MAX < Postgres max_connections − headroom`

Reserve connections for admins, backups, and other services. Hosted Postgres often caps **`max_connections`** on smaller tiers — check the provider dashboard.

---

## External poolers (PgBouncer, provider pool)

1. Terminate TLS at your LB / proxy; forward **`DATABASE_URL`** to the pooler.
2. Prefer **session pooling** if you cannot use **`DATABASE_DIRECT_URL`** for migrations (some teams run migrations from CI with a direct URL only).
3. **Transaction pooling** + Prisma: follow current [Prisma + PgBouncer](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management/configure-prisma-with-pgbouncer) guidance (`pgbouncer=true` and provider-specific query params when required).

---

## Verification

- After changing pool URLs: `npm run db:migrate:deploy` (or container entrypoint) succeeds.
- `GET /api/health` runs `SELECT 1` — use it after deploy to confirm connectivity.
- Watch Postgres “too many connections” errors — lower **`DATABASE_POOL_MAX`** or add replicas behind a pooler.
