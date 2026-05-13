# Aqila IMS — Inventory & Management System

Internal web application for **Aqila AS**, an electrical installation company in Lofoten, Norway. It centralises **inventory**, **purchase orders**, **employees**, **installation projects**, and operational workflows so field and office staff share one source of truth instead of spreadsheets and ad hoc communication.

This README is the **entry-point documentation**: what the product is for, **why** it is shaped this way, and **how** the implementation addresses real operational and engineering problems. Deep dives live under [`docs/`](docs/).

---

## Table of contents

1. [What this project is](#what-this-project-is)
2. [Problems it solves](#problems-it-solves)
3. [Architecture at a glance](#architecture-at-a-glance)
4. [How the code solves specific concerns](#how-the-code-solves-specific-concerns)
5. [Repository layout](#repository-layout)
6. [Features (product modules)](#features-product-modules)
7. [Tech stack](#tech-stack)
8. [Getting started](#getting-started)
9. [Database & migrations](#database--migrations)
10. [Testing](#testing)
11. [Git workflow](#git-workflow)
12. [Docker](#docker)
13. [CI/CD](#cicd)
14. [Environment variables](#environment-variables)
15. [Documentation index](#documentation-index)
16. [Production deployment](#production-deployment)
17. [Licence](#licence)

---

## What this project is

A **role-based** operational system: staff record stock movements and attendance; managers approve exceptions and see backlog; admins configure master data and users. Data lives in **PostgreSQL**; the UI is a **Next.js** app with **Server Actions** for mutations and **TanStack Query** where client caching helps.

It is **not** a generic ERP: workflows reflect inventory + PO receive + project material flows that matter for installation jobs (reserve → consume, audit trail, low-stock signals).

---

## Problems it solves

| Problem                                     | Direction the product takes                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stock truth fragmented across locations     | Single catalog; quantities **per location**; every change becomes an immutable [**stock movement**](#inventory) record                                                   |
| PO receiving doesn’t hit inventory reliably | PO lifecycle tied to **receive** actions that create **IN** movements and advance status automatically                                                                   |
| Who can see or change what is unclear       | **Four roles** (Admin, Manager, Staff, Viewer) with [**route-level**](#authentication--rbac) and action-level checks                                                     |
| Incidents or audits need a trail            | **Audit events** and movement history back queries                                                                                                                       |
| Deployments must be repeatable              | **Prisma migrations** in git, **`migrate deploy`** on boot ([`docker/entrypoint.sh`](docker/entrypoint.sh)), CI + integration tests                                      |
| Production needs guardrails                 | Env validation ([`src/lib/validate-production-env.ts`](src/lib/validate-production-env.ts)), security headers, optional **HTTPS upgrade**, rate limits, backups playbook |

---

## Architecture at a glance

```text
Browser ──► CDN / reverse proxy (TLS, X-Forwarded-*)
              │
              ▼
       Next.js App Router (React 19)
              │
       ┌──────┴──────┐
       │             │
  proxy.ts       Server Components
  (edge)         + Server Actions
  RBAC,             │
  request-id        ▼
                auth() + rbac helpers
                │
                ▼
            Prisma + pg pool ──► PostgreSQL
```

- **Edge [`proxy.ts`](src/proxy.ts)** — Session gate for pages, role-based redirects, `x-request-id`, optional HTTPS upgrade when the app URL is `https:` but the request arrives as `http` behind a misconfigured proxy ([`src/lib/https-upgrade.ts`](src/lib/https-upgrade.ts)).
- **Server** — Business logic in [`src/lib/actions/`](src/lib/actions/), queries in [`src/lib/queries/`](src/lib/queries/), validation with **Zod**, persistence with **Prisma** ([`prisma/schema.prisma`](prisma/schema.prisma)).
- **Auth** — **Auth.js v5** with JWT sessions and credentials; password hashing with **bcryptjs**; invites and OTP flows where configured ([`src/lib/auth.config.ts`](src/lib/auth.config.ts), [`src/lib/auth.ts`](src/lib/auth.ts)).

---

## How the code solves specific concerns

### Authentication & RBAC

**Why:** Electrical installers and office staff must not all have admin rights; viewers need read-only paths without export or pricing sensitive CSVs.

**How:**

- Role checks are centralised in [`src/lib/rbac.ts`](src/lib/rbac.ts) (e.g. `canAccessManagerHub`, `viewerBlockedWritePathname`, export permissions).
- [`src/proxy.ts`](src/proxy.ts) enforces **which URL prefixes** each role may hit before RSC runs (keeps Edge bundle free of Prisma).
- Server Actions and Route Handlers still call **`auth()`** and re-check rules — **never rely on UI alone**.

### Inventory integrity

**Why:** Stock errors propagate to customer jobs and purchasing.

**How:**

- Stock is updated through validated actions (e.g. [`src/lib/actions/inventory.ts`](src/lib/actions/inventory.ts)) so quantity and **reserved** fields stay consistent with **movements**.
- **Transfers** are modeled as paired logic (source decrement, destination increment) with audit-friendly movement rows.

### Purchase orders & receiving

**Why:** Receiving must match what was ordered and update stock in one logical step.

**How:**

- PO state machine in schema + actions ([`src/lib/actions/purchase-orders.ts`](src/lib/actions/purchase-orders.ts)); receiving creates **IN** movements and rolls status forward (`PARTIALLY_RECEIVED` / `RECEIVED`).

### Projects & materials

**Why:** Jobs consume stock; finance needs cost snapshots.

**How:**

- **Reservation** increases `reserved`; **consumption** posts **OUT** movements and reduces both `quantity` and `reserved`. Job cost uses **unit cost at reservation time** (documented in [Module overview](#features-product-modules)).

### Email & scheduled jobs

**Why:** Digests and escalations should run without a human clicking send.

**How:**

- Nodemailer transport ([`src/lib/email/`](src/lib/email/)); cron-style **`GET /api/cron/digest-email`** protected by bearer **`CRON_SECRET`** ([`src/lib/cron-auth.ts`](src/lib/cron-auth.ts)). GitHub workflow template: [`.github/workflows/cron-digest-email.yml`](.github/workflows/cron-digest-email.yml).

### Abuse resistance & multi-instance

**Why:** Credential stuffing and forgot-password spam should not overwhelm SMTP or the DB.

**How:**

- Rate limiting on sensitive auth paths ([`src/lib/auth-rate-limit.ts`](src/lib/auth-rate-limit.ts)); optional **Upstash Redis** for distributed limits ([`src/lib/auth-rate-limit-backend.ts`](src/lib/auth-rate-limit-backend.ts)).

### Observability & operations

**Why:** On-call needs health, revision identity, and traces/logs.

**How:**

- **`GET /api/health`** — DB probe + optional **`revision`** from env ([`docs/application-observability.md`](docs/application-observability.md)).
- Structured logging + **`x-request-id`** ([`docs/logging-and-correlation.md`](docs/logging-and-correlation.md)).
- Optional **OpenTelemetry** OTLP HTTP exporter when **`OTEL_ENABLED=true`** ([`src/lib/node-otel.ts`](src/lib/node-otel.ts), [`src/instrumentation.ts`](src/instrumentation.ts)).

### Database connection pooling (serverless / high concurrency)

**Why:** Raw Prisma connections can exhaust Postgres **`max_connections`** when scaling out.

**How:**

- Shared **`pg` pool** via Prisma adapter ([`src/lib/db.ts`](src/lib/db.ts), [`src/lib/db-pool-config.ts`](src/lib/db-pool-config.ts)); optional **`DATABASE_DIRECT_URL`** for migrations when **`DATABASE_URL`** points at a pooler ([`docs/database-connection-pooling.md`](docs/database-connection-pooling.md)).

---

## Repository layout

| Path                                       | Role                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| [`src/app/`](src/app/)                     | App Router pages, layouts, API routes                                          |
| [`src/components/`](src/components/)       | UI by domain (inventory, POs, portal, …) + shared primitives                   |
| [`src/lib/actions/`](src/lib/actions/)     | Server Actions — mutations and orchestration                                   |
| [`src/lib/queries/`](src/lib/queries/)     | Read-heavy Prisma queries for dashboards and lists                             |
| [`src/lib/`](src/lib/)                     | Auth, RBAC, validation schemas, email, notifications, security headers         |
| [`prisma/`](prisma/)                       | `schema.prisma`, migrations, seed script                                       |
| [`docker/`](docker/)                       | Compose for local stack, production entrypoint, optional OTel collector config |
| [`docs/`](docs/)                           | Runbooks, production readiness, privacy, backups, DNS, go-live                 |
| [`tests/integration/`](tests/integration/) | DB-backed integration tests (see [Testing](#testing))                          |
| [`tests/e2e/`](tests/e2e/)                 | Playwright smoke (opt-in)                                                      |
| [`.github/workflows/`](.github/workflows/) | CI, CD, cron, backups, audit reports                                           |

---

## Features (product modules)

| Module                | Capabilities                                                                         |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Dashboard**         | KPIs, low-stock signals, movement trends                                             |
| **Inventory**         | Catalog, per-location stock, movement ledger, reorder alerts, barcode-friendly flows |
| **Purchase orders**   | Draft → received lifecycle; receiving drives stock **IN**                            |
| **Employees**         | Profiles, attendance, scheduling hooks, CSV export (RBAC-scoped)                     |
| **Projects**          | Work orders, reservation → consumption, job cost summary                             |
| **Reports & exports** | Charts (Recharts), CSV exports gated by role                                         |
| **Settings**          | Locations, categories, units, invitations (Admin)                                    |
| **Portal / “me”**     | Staff-facing shortcuts and preferences where implemented                             |
| **Auth & RBAC**       | Admin, Manager, Staff, Viewer — enforced in [`proxy.ts`](src/proxy.ts) + server      |

### Inventory (conceptual model)

- Products are **global**; **`quantity`** and **`reserved`** are **per location**.
- Every quantity change creates an immutable **`StockMovement`** row (audit + reconciliation).

### Purchase orders

Lifecycle includes **`DRAFT` → … → `RECEIVED`**; partial receives update status automatically from quantities received.

### Employees

Linked **`User`** accounts for login; attendance upserts per employee/date; hours derived from check-in/out where recorded.

### Projects

**Reserve** bumps **`reserved`**; **consume** writes **OUT** movements and reduces **`quantity`** and **`reserved`**. Job cost uses **`usedQuantity × unitCostAtTime`** (snapshot at reservation).

---

## Tech stack

| Layer              | Choice                                                                          |
| ------------------ | ------------------------------------------------------------------------------- |
| Framework          | **Next.js 16** (App Router, [`proxy.ts`](src/proxy.ts) middleware successor)    |
| Language           | **TypeScript 5**                                                                |
| UI                 | **React 19**, **Tailwind CSS v4**, **shadcn/ui**                                |
| Data               | **PostgreSQL 16**, **Prisma 7** (+ **`pg`** adapter for pooling)                |
| Auth               | **Auth.js v5** (NextAuth)                                                       |
| Forms / validation | **React Hook Form**, **Zod**                                                    |
| Client state       | **TanStack Query v5**                                                           |
| Charts             | **Recharts**                                                                    |
| Ops                | **Docker**, **GitHub Actions**, optional **Playwright**, **OpenTelemetry** OTLP |

---

## Getting started

### Prerequisites

- **Node.js ≥ 22**, **npm ≥ 10**
- **PostgreSQL 16**, or Docker Compose (see [Docker](#docker))

### Quick path

```bash
git clone https://github.com/saidulIslam1602/Inventory-Management-System.git
cd Inventory-Management-System
npm install
cp .env.example .env
# Set DATABASE_URL, AUTH_SECRET (openssl rand -base64 32), NEXTAUTH_URL
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Default dev URL is defined in [`scripts/dev.sh`](scripts/dev.sh) (commonly port **3010** — open the URL printed in the terminal).

### Demo users (after seed)

| Role    | Email            | Password   |
| ------- | ---------------- | ---------- |
| Admin   | admin@aqila.no   | Aqila2026! |
| Manager | manager@aqila.no | Aqila2026! |
| Staff   | staff@aqila.no   | Aqila2026! |

---

## Database & migrations

Prisma owns the schema; migrations under [`prisma/migrations/`](prisma/migrations/) are the source of truth.

```bash
npm run db:migrate          # dev: create/apply migrations (interactive name)
npm run db:migrate:deploy   # CI/production: apply pending only
npm run db:studio           # browse data
npm run db:reset && npm run db:seed   # destructive dev reset only
```

**Baseline / existing DB without migration history:** see [`AGENTS.md`](AGENTS.md) (`migrate resolve`, avoid blind deploy on legacy DBs).

**Backups & restore drills:** [`docs/database-backups-and-restore.md`](docs/database-backups-and-restore.md) — includes logical dumps ([`scripts/pg-backup.sh`](scripts/pg-backup.sh)) and GitHub workflow [`.github/workflows/db-backup.yml`](.github/workflows/db-backup.yml) (optional upload to Azure Blob / S3).

---

## Testing

| Command                             | Purpose                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run test` / `npm run test:ci`  | Unit tests (**Jest**); CI excludes Playwright and integration paths via [`jest.config.ts`](jest.config.ts)        |
| `npm run test:integration`          | Postgres integration flows ([`tests/integration/`](tests/integration/)); needs **`DATABASE_URL`** and migrated DB |
| `PLAYWRIGHT_RUN=1 npm run test:e2e` | Optional UI smoke (`npx playwright install` first)                                                                |

---

## Git workflow

- **`main`** — production (protected; CI required)
- **`develop`**, **`feature/*`**, **`fix/*`**, **`chore/*`** — typical branching

[Conventional Commits](https://www.conventionalcommits.org/) enforced via **commitlint** + Husky. **lint-staged** runs ESLint on pre-commit.

---

## Docker

### Local (Compose)

```bash
docker compose -f docker/docker-compose.yml --profile dev up
```

Typical defaults from [`docker/docker-compose.yml`](docker/docker-compose.yml):

| Service    | URL / port                                                                               |
| ---------- | ---------------------------------------------------------------------------------------- |
| App        | **http://localhost:3020** (container listens on 3000; override with **`APP_HOST_PORT`**) |
| PostgreSQL | **`localhost:15432`** → container `5432` (override with **`POSTGRES_HOST_PORT`**)        |
| Adminer    | **http://localhost:8080** — only with **`--profile dev`**                                |

Without **`--profile dev`**, Compose starts **app + db** only (no Adminer).

### Production image

Multi-stage build → **`standalone`** output. [`docker/entrypoint.sh`](docker/entrypoint.sh) runs **`prisma migrate deploy`** then **`next start`**.

```bash
docker build -t aqila-ims:latest .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="..." \
  -e NEXTAUTH_URL="https://your-domain" \
  aqila-ims:latest
```

---

## CI/CD

### CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))

Lint → typecheck → **Jest** → **`npm audit`** (high+) → **`next build`**, plus **integration** job (Postgres service → migrate deploy → **`test:integration`**).

Dependabot: [`.github/dependabot.yml`](.github/dependabot.yml). Weekly advisory artefact: [`npm-audit-report.yml`](.github/workflows/npm-audit-report.yml).

**Optional workflows** (configure secrets/vars): [cron digest](.github/workflows/cron-digest-email.yml), [DB backup](.github/workflows/db-backup.yml), [Playwright](.github/workflows/e2e-playwright.yml).

### CD ([`.github/workflows/cd.yml`](.github/workflows/cd.yml))

On merge to **`main`**: build → push image → deploy to VPS → healthcheck (rollback on failure).

Typical secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, plus runtime env mirroring production (`DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, …).

---

## Environment variables

Authoritative list and comments: **`.env.example`**.

Operational topics (vault storage, rotation, production assertions): [`docs/secrets-and-config.md`](docs/secrets-and-config.md).

**Minimal mental model:**

| Variable                    | Role                                                            |
| --------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`              | App runtime Postgres (pooler allowed)                           |
| `DATABASE_DIRECT_URL`       | Direct URL for **`prisma migrate`** when pooled                 |
| `AUTH_SECRET`               | Auth.js signing secret (**≥ 32** chars in production)           |
| `NEXTAUTH_URL` / `AUTH_URL` | Public origin (**HTTPS** in real deployments)                   |
| `CRON_SECRET`               | Bearer for cron route when used (**≥ 24** chars if set in prod) |

Optional: **Upstash** (`UPSTASH_*`) for distributed rate limits; **OTEL** (`OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_*`, headers); **Playwright** vars for smoke tests.

---

## Documentation index

Use these when you care about **why** something is configured a certain way or **what to run** in production.

| Topic                                               | Doc                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Production readiness tracker                        | [`docs/production-readiness.md`](docs/production-readiness.md)                         |
| Go-live execution (TLS, DNS, vault, legal, backups) | [`docs/go-live-execution-checklist.md`](docs/go-live-execution-checklist.md)           |
| Secrets & GitHub / Key Vault mapping                | [`docs/secrets-vault-and-github-mapping.md`](docs/secrets-vault-and-github-mapping.md) |
| TLS, DNS, hosting patterns                          | [`docs/tls-dns-hosting-playbook.md`](docs/tls-dns-hosting-playbook.md)                 |
| Vendor DPA / subprocessors worksheet                | [`docs/vendor-dpa-checklist.md`](docs/vendor-dpa-checklist.md)                         |
| DB backups & restore drills                         | [`docs/database-backups-and-restore.md`](docs/database-backups-and-restore.md)         |
| Pooling & `DATABASE_DIRECT_URL`                     | [`docs/database-connection-pooling.md`](docs/database-connection-pooling.md)           |
| Indexes & slow queries                              | [`docs/database-performance.md`](docs/database-performance.md)                         |
| HTTPS, proxies, cookies                             | [`docs/https-and-cookies.md`](docs/https-and-cookies.md)                               |
| Logging & correlation IDs                           | [`docs/logging-and-correlation.md`](docs/logging-and-correlation.md)                   |
| Health, SLOs, OTEL                                  | [`docs/application-observability.md`](docs/application-observability.md)               |
| DR, rollback, cron                                  | [`docs/disaster-recovery-runbooks.md`](docs/disaster-recovery-runbooks.md)             |
| Email SPF/DKIM/DMARC                                | [`docs/email-dns-authentication.md`](docs/email-dns-authentication.md)                 |
| Privacy & retention                                 | [`docs/privacy-retention-and-erasure.md`](docs/privacy-retention-and-erasure.md)       |
| RoPA / lawful basis template                        | [`docs/ropa-lawful-basis-template.md`](docs/ropa-lawful-basis-template.md)             |
| Agent / migration rules                             | [`AGENTS.md`](AGENTS.md)                                                               |

---

## Production deployment

1. Follow **`docs/production-readiness.md`** and **`docs/go-live-execution-checklist.md`** for sign-off items.
2. **Docker on VPS** — typical path via CD workflow; ensure Postgres and secrets are set.
3. **Vercel + Neon (or similar)** — set env vars; run **`npm run db:migrate:deploy`** from CI or CLI after deploy.
4. **Any PostgreSQL host** — Supabase, RDS, Azure Database for PostgreSQL work as long as **`DATABASE_URL`** is valid.

---

## Licence

Internal use — **Aqila AS**. All rights reserved.
