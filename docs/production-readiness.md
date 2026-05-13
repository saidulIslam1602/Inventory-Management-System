# Production readiness — Aqila IMS

This document ties **what the codebase already does** to a practical path toward **production-grade** operations: reliability, security, observability, and maintainability. It is not a guarantee of compliance (GDPR, SOC 2, etc.); treat those as separate exercises with legal/security owners.

**Related:** [`README.md`](../README.md), [`AGENTS.md`](../AGENTS.md), [`go-live-execution-checklist.md`](./go-live-execution-checklist.md), [`ropa-lawful-basis-template.md`](./ropa-lawful-basis-template.md), [`secrets-and-config.md`](./secrets-and-config.md), [`privacy-retention-and-erasure.md`](./privacy-retention-and-erasure.md), [`disaster-recovery-runbooks.md`](./disaster-recovery-runbooks.md), [`database-performance.md`](./database-performance.md), [`email-dns-authentication.md`](./email-dns-authentication.md), [`database-connection-pooling.md`](./database-connection-pooling.md), [`https-and-cookies.md`](./https-and-cookies.md), [`database-backups-and-restore.md`](./database-backups-and-restore.md), [`logging-and-correlation.md`](./logging-and-correlation.md), [`application-observability.md`](./application-observability.md), [`src/lib/auth-rate-limit.ts`](../src/lib/auth-rate-limit.ts), [`src/lib/auth-rate-limit-backend.ts`](../src/lib/auth-rate-limit-backend.ts), [`src/lib/https-upgrade.ts`](../src/lib/https-upgrade.ts), [`src/lib/node-otel.ts`](../src/lib/node-otel.ts), [`src/lib/security-headers.ts`](../src/lib/security-headers.ts) + [`next.config.ts`](../next.config.ts), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), [`.github/workflows/cron-digest-email.yml`](../.github/workflows/cron-digest-email.yml), [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml), [`.github/workflows/npm-audit-report.yml`](../.github/workflows/npm-audit-report.yml), [`.github/dependabot.yml`](../.github/dependabot.yml), [`src/lib/cron-auth.ts`](../src/lib/cron-auth.ts), [`src/lib/rbac.ts`](../src/lib/rbac.ts) + [`src/proxy.ts`](../src/proxy.ts), [`portal-high-impact.md`](./portal-high-impact.md).

**Last tracker update:** 2026-05-14 — repository **software package** complete (CI, integration tests, optional Redis/OTel, workflows, execution checklist). Per-environment sign-off: [`go-live-execution-checklist.md`](./go-live-execution-checklist.md).

---

## Progress tracker (living)

Use **Status:** `Done` · `Partial` · `Not started`. Rows below are **Done** for in-repo automation + documented templates; operators still **execute** DNS/TLS/vault items via the go-live checklist before calling a specific deployment “verified production.”

| ID     | Item                                                    | Status   | Where / notes                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1a** | Unit tests (RBAC, search params, stock filters/display) | **Done** | [`src/lib/__tests__/`](../src/lib/__tests__/): `rbac`, `search-params`, `stock-movement-display`, `stock-movements`, `cron-auth`, `db-pool-config`, …                                                                                                        |
| **1b** | CI: `test:ci` fails on empty/broken suite               | **Done** | `package.json` — `jest --ci --coverage` (no `--passWithNoTests`)                                                                                                                                                                                             |
| **1c** | Jest + Prisma under jsdom (`TextEncoder` polyfill)      | **Done** | [`jest.setup.ts`](../jest.setup.ts)                                                                                                                                                                                                                          |
| **1d** | Integration tests (DB): PO receive → movement           | **Done** | [`tests/integration/inventory-flows.integration.test.ts`](../tests/integration/inventory-flows.integration.test.ts); CI **`integration`** job                                                                                                                |
| **1e** | Integration tests (DB): project reserve → consume       | **Done** | Same                                                                                                                                                                                                                                                         |
| **1f** | Playwright smoke (login shell)                          | **Done** | [`tests/e2e/smoke.spec.ts`](../tests/e2e/smoke.spec.ts); optional [`e2e-playwright.yml`](../.github/workflows/e2e-playwright.yml)                                                                                                                            |
| **2**  | Align Docker entrypoint with `migrate deploy`           | **Done** | [`docker/entrypoint.sh`](../docker/entrypoint.sh); [`AGENTS.md`](../AGENTS.md) baseline notes                                                                                                                                                                |
| **3**  | Secrets in vault + rotation discipline                  | **Done** | [`secrets-and-config.md`](./secrets-and-config.md); prod asserts [`validate-production-env.ts`](../src/lib/validate-production-env.ts); checklist § A                                                                                                        |
| **4**  | HTTPS + Auth.js cookie flags for prod                   | **Done** | [`https-and-cookies.md`](./https-and-cookies.md); secure cookies [`auth-cookie-policy.ts`](../src/lib/auth-cookie-policy.ts); prod **`http→https`** upgrade [`https-upgrade.ts`](../src/lib/https-upgrade.ts) + [`proxy.ts`](../src/proxy.ts); checklist § B |
| **5**  | DB backups + restore drill documented                   | **Done** | [`database-backups-and-restore.md`](./database-backups-and-restore.md); [`scripts/pg-backup.sh`](../scripts/pg-backup.sh); [`db-backup.yml`](../.github/workflows/db-backup.yml); checklist § C                                                              |
| **6**  | Structured logging + correlation IDs                    | **Done** | [`logging-and-correlation.md`](./logging-and-correlation.md); [`logger.ts`](../src/lib/logger.ts), [`proxy.ts`](../src/proxy.ts); checklist § D                                                                                                              |
| **7**  | APM / OpenTelemetry + SLOs                              | **Done** | [`application-observability.md`](./application-observability.md); [`node-otel.ts`](../src/lib/node-otel.ts) + [`instrumentation.ts`](../src/instrumentation.ts); checklist § D                                                                               |
| **8**  | Rate limiting on auth surfaces                          | **Done** | Memory + optional Upstash [`auth-rate-limit-backend.ts`](../src/lib/auth-rate-limit-backend.ts), [`auth-rate-limit.ts`](../src/lib/auth-rate-limit.ts); checklist § E                                                                                        |
| **9**  | Security headers (HSTS, CSP, …)                         | **Done** | [`security-headers.ts`](../src/lib/security-headers.ts), [`next.config.ts`](../next.config.ts); checklist § E                                                                                                                                                |
| **10** | `npm audit` in CI + Dependabot/Renovate                 | **Done** | [`audit:ci`](../package.json); [`ci.yml`](../.github/workflows/ci.yml); grouped [`dependabot.yml`](../.github/dependabot.yml); [`npm-audit-report.yml`](../.github/workflows/npm-audit-report.yml); checklist § F                                            |
| **11** | Cron `/api/cron/*` lockdown                             | **Done** | [`cron-auth.ts`](../src/lib/cron-auth.ts), [`digest-email/route.ts`](../src/app/api/cron/digest-email/route.ts); [`cron-digest-email.yml`](../.github/workflows/cron-digest-email.yml); checklist § G                                                        |
| **12** | Connection pooling (PgBouncer / provider pooler)        | **Done** | [`database-connection-pooling.md`](./database-connection-pooling.md); [`db-pool-config.ts`](../src/lib/db-pool-config.ts); [`prisma.config.ts`](../prisma.config.ts); checklist § C                                                                          |
| **13** | Email SPF/DKIM/DMARC                                    | **Done** | [`email-dns-authentication.md`](./email-dns-authentication.md); checklist § G                                                                                                                                                                                |
| **14** | Privacy / retention / deletion runbooks                 | **Done** | [`privacy-retention-and-erasure.md`](./privacy-retention-and-erasure.md); [`ropa-lawful-basis-template.md`](./ropa-lawful-basis-template.md); checklist § H                                                                                                  |
| **15** | DR runbooks (rollback, break-glass, …)                  | **Done** | [`disaster-recovery-runbooks.md`](./disaster-recovery-runbooks.md); checklist § I                                                                                                                                                                            |
| **16** | Performance: slow-query review + indexes                | **Done** | [`database-performance.md`](./database-performance.md); migration [`20260514100000_performance_indexes`](../prisma/migrations/20260514100000_performance_indexes/migration.sql); checklist § D                                                               |

---

## 1. System snapshot (how the app is shaped today)

| Layer                       | Implementation                                                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Runtime**                 | Next.js App Router, TypeScript, Server Actions + Route Handlers                                                                                                                                                                  |
| **Data**                    | PostgreSQL via Prisma (schema in `prisma/schema.prisma`; URLs in `prisma.config.ts` + [`db.ts`](../src/lib/db.ts)); runtime **`pg.Pool`** tunable via env; optional **`DATABASE_DIRECT_URL`** for migrations when using a pooler |
| **Auth**                    | Auth.js v5 (NextAuth), credentials + sessions; `mustChangePassword` gate in `src/proxy.ts`                                                                                                                                       |
| **Authorization**           | Edge **`proxy.ts`** — **`x-request-id`** on pages + **`/api/*`**; RBAC redirects on pages only; **`/api/*`** handlers call `auth()` + `rbac.ts`                                                                                  |
| **Audit**                   | Append-only `AuditEvent`, PO audit trail, stock movements — good basis for investigations                                                                                                                                        |
| **Background / cron**       | `GET /api/cron/digest-email` — SHA-256 timing-safe bearer check (`CRON_SECRET`), optional `CRON_ALLOWED_IPS`                                                                                                                     |
| **Shipping**                | Docker multi-stage build (`Dockerfile`), `output: "standalone"`, non-root user                                                                                                                                                   |
| **Health**                  | `GET /api/health` — `SELECT 1` via Prisma + optional **`revision`** (`APP_VERSION` / CI SHA envs); Compose / LB probes                                                                                                           |
| **DB perf**                 | Baseline **`@@index`** on movements, notifications, PO/project lists, attendance, shifts, `Stock.locationId` — see [`database-performance.md`](./database-performance.md)                                                        |
| **Outbound email**          | Nodemailer + **`SMTP_*`** ([`nodemailer-transport.ts`](../src/lib/nodemailer-transport.ts)); DNS authentication runbook [`email-dns-authentication.md`](./email-dns-authentication.md)                                           |
| **Personal data**           | See inventory + export/erasure notes in [`privacy-retention-and-erasure.md`](./privacy-retention-and-erasure.md); RoPA template [`ropa-lawful-basis-template.md`](./ropa-lawful-basis-template.md)                               |
| **HTTPS edge behaviour**    | Production navigations: **`http`** + `X-Forwarded-Proto: http` → **308** to HTTPS when public URL is `https:` ([`https-upgrade.ts`](../src/lib/https-upgrade.ts))                                                                |
| **Distributed rate limits** | Optional Upstash Redis REST ([`auth-rate-limit-backend.ts`](../src/lib/auth-rate-limit-backend.ts))                                                                                                                              |
| **Tracing**                 | Optional OTLP exporter when **`OTEL_ENABLED=true`** ([`node-otel.ts`](../src/lib/node-otel.ts))                                                                                                                                  |
| **CI**                      | Lint, typecheck, unit tests, audit (**high**+), build + **`integration`** (Postgres → migrate → [`tests/integration/`](../tests/integration/))                                                                                   |

**Domain breadth:** inventory + locations, PO lifecycle, receiving, projects/material flow, employees/attendance/shifts, customers, notifications, manager hub, reports, settings/admin tooling — i.e. multi-module internal ERP/IMS, not a single-feature demo.

---

## 2. What is already “production-oriented”

- **Explicit RBAC** documented in code (`rbac.ts`) and enforced at the edge for dashboards; sensitive exports separated from UI-only financial context.
- **Schema discipline:** versioned migrations under `prisma/migrations/` (see `AGENTS.md` for deploy vs baseline rules).
- **Container hygiene:** standalone output, dedicated health endpoint, Compose wiring examples.
- **Operational hooks:** email digest cron pattern with shared secret; audit logging hooks for exports and security-sensitive actions (extend as you add surfaces).
- **CI posture:** lint, typecheck, unit tests, **`integration`** DB tests, **`audit:ci`**, production **`next build`**, Dependabot — mandatory on `main` ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

---

## 3. Repository vs organisation execution

Trackers **1a–16** above are **Done** for **software + automation shipped in git**. Organisation-specific steps (TLS certificates, DNS SPF records, vault placement, synthetic probes, RoPA sign-off, backup retention in object storage, restore drills, pool sizing vs vendor tiers) are **not** something a repo can “finish” without your hosts — they live in **[`go-live-execution-checklist.md`](./go-live-execution-checklist.md)** sections **A–J**.

Use **section 3** here as the narrative anchor and **that checklist** as the per-environment execution workbook.

### Repository artefacts (complete)

- [x] Unit + integration tests + Playwright scaffold (see tracker **1a–1f**).
- [x] Secrets validation + optional Upstash + optional OTEL ([`instrumentation.ts`](../src/instrumentation.ts)).
- [x] HTTPS cookie policy + selective **`http→https`** upgrade on HTML navigations.
- [x] Backup script + optional **`db-backup.yml`** workflow artefact.
- [x] Cron workflow template **`cron-digest-email.yml`**.
- [x] Weekly **`npm-audit-report`** JSON artefact + Dependabot grouping.
- [x] Pooling / perf / privacy / DR **runbooks** + RoPA **template**.

---

## 4. Verification checklist (go-live gate)

Tick **`Met?`** only after you complete **[`go-live-execution-checklist.md`](./go-live-execution-checklist.md) § J** on the target environment (usually staging first, then production).

| Area     | Met? | Check                                                                                       |
| -------- | ---- | ------------------------------------------------------------------------------------------- |
| Auth     | [ ]  | Sessions behave as expected; password reset + invite flows tested                           |
| RBAC     | [ ]  | Each role: blocked routes → redirect/403; export APIs match `rbac.ts`                       |
| Data     | [ ]  | Migrations via approved mechanism; backup / restore drill satisfied                         |
| Ops      | [ ]  | `/api/health` green behind LB; cron success path; log/trace sinks live                      |
| Security | [ ]  | TLS valid; headers reviewed; no secrets in repo                                             |
| DR       | [ ]  | Rollback path rehearsed; [`disaster-recovery-runbooks.md`](./disaster-recovery-runbooks.md) |

---

## 5. Suggested phases

1. **Execute go-live checklist on staging** (`go-live-execution-checklist.md` **A–J**).
2. **Merge to production** with same checklist + § **J** verification.
3. **Iterate:** tighten CSP, dashboard caching, advanced DR game-days as usage grows.

---

## 6. Keeping this document honest

- **Done** in the tracker means **repository deliverables exist**; it does **not** replace TLS/DNS/legal execution — use [`go-live-execution-checklist.md`](./go-live-execution-checklist.md).
- When behaviour changes, update **Where / notes** pointers and bump **Last tracker update**.
- Out-of-date runbooks are worse than none — link to canonical scripts and [`.env.example`](../.env.example).
