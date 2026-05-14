# Go-live execution checklist — Aqila IMS

Single place to **execute** what the repo cannot automate: TLS termination, DNS, secret managers, vendor dashboards, and legal sign-off.  
Repository artifacts already cover headers, rate limits (memory + optional Redis), structured logs, health probes, migrations, CI gates, integration tests, workflow templates, **backup uploads to Azure Blob / S3** ([`db-backup.yml`](../.github/workflows/db-backup.yml)), **OTLP wiring** ([`node-otel.ts`](../src/lib/node-otel.ts)), and execution playbooks ([`secrets-vault-and-github-mapping.md`](./secrets-vault-and-github-mapping.md), [`tls-dns-hosting-playbook.md`](./tls-dns-hosting-playbook.md), [`vendor-dpa-checklist.md`](./vendor-dpa-checklist.md)).

**Related:** [`production-readiness.md`](./production-readiness.md), [`secrets-and-config.md`](./secrets-and-config.md), [`secrets-vault-and-github-mapping.md`](./secrets-vault-and-github-mapping.md), [`https-and-cookies.md`](./https-and-cookies.md), [`database-backups-and-restore.md`](./database-backups-and-restore.md), [`disaster-recovery-runbooks.md`](./disaster-recovery-runbooks.md), [`email-dns-authentication.md`](./email-dns-authentication.md), [`privacy-retention-and-erasure.md`](./privacy-retention-and-erasure.md), [`ropa-lawful-basis-template.md`](./ropa-lawful-basis-template.md), [`vendor-dpa-checklist.md`](./vendor-dpa-checklist.md), [`tls-dns-hosting-playbook.md`](./tls-dns-hosting-playbook.md), [`application-observability.md`](./application-observability.md), [`database-performance.md`](./database-performance.md).

---

## A. Secrets & configuration

Follow **[`secrets-vault-and-github-mapping.md`](./secrets-vault-and-github-mapping.md)** then verify:

- [ ] Production secrets live in a **vault / platform secret store** — never committed; rotation owners recorded
- [ ] `AUTH_SECRET` ≥ 32 chars; `CRON_SECRET` ≥ 24 chars when cron is enabled
- [ ] Optional **`UPSTASH_REDIS_REST_URL`** + **`UPSTASH_REDIS_REST_TOKEN`** for **distributed** auth rate limits ([`auth-rate-limit-backend.ts`](../src/lib/auth-rate-limit-backend.ts))
- [ ] Optional **`OTEL_ENABLED=true`** + **`OTEL_EXPORTER_OTLP_ENDPOINT`** (HTTPS ingest) + optional **`OTEL_EXPORTER_OTLP_HEADERS`** ([`node-otel.ts`](../src/lib/node-otel.ts), [`instrumentation.ts`](../src/instrumentation.ts))

---

## B. TLS, HTTPS, cookies

Use **[`tls-dns-hosting-playbook.md`](./tls-dns-hosting-playbook.md)** then verify:

- [ ] TLS terminates at LB / ingress with valid certificates
- [ ] Reverse proxy sets **`X-Forwarded-Proto`** and **`Host`** honestly ([`https-and-cookies.md`](./https-and-cookies.md))
- [ ] Staging spot-check: login → cookies show **`Secure`**, **`HttpOnly`**, **`SameSite=Lax`**
- [ ] Production **`AUTH_URL` / `NEXTAUTH_URL`** use `https://…` so middleware can upgrade plain **`http://`** navigations when forwarded proto is `http` ([`https-upgrade.ts`](../src/lib/https-upgrade.ts))

---

## C. Data plane

- [ ] **`prisma migrate deploy`** on deploy ([`docker/entrypoint.sh`](../docker/entrypoint.sh), [`AGENTS.md`](../AGENTS.md))
- [ ] Managed Postgres **automated backups** **or** scheduled logical dumps **off-site** ([`database-backups-and-restore.md`](./database-backups-and-restore.md))
- [ ] GitHub Action **`db-backup.yml`**: secret **`DATABASE_BACKUP_URL`**; optional **`BACKUP_SCHEDULE_ENABLED=true`** for daily runs; variables **`BACKUP_UPLOAD`** (`azure` / `s3` / …) + cloud secrets per **[`database-backups-and-restore.md`](./database-backups-and-restore.md)**
- [ ] **Restore drill** logged (date, owner, artefact id, outcome)
- [ ] Pool tier: **`max_connections`** vs \*\*`DATABASE_POOL_MAX` × instances ([`database-connection-pooling.md`](./database-connection-pooling.md))

---

## D. Observability & operations

- [ ] Ship JSON logs (`stdout`) to aggregation; alert on error spikes ([`logging-and-correlation.md`](./logging-and-correlation.md))
- [ ] Synthetic **`GET /api/health`** checks + **`revision`** in release notes ([`application-observability.md`](./application-observability.md))
- [ ] OTEL: **`OTEL_ENABLED=true`** + HTTPS **`OTEL_EXPORTER_OTLP_ENDPOINT`** + backend dashboards ([`application-observability.md`](./application-observability.md))
- [ ] Enable vendor **slow query** / `pg_stat_statements` sampling ([`database-performance.md`](./database-performance.md))

---

## E. Abuse resistance & headers

- [ ] Confirm trusted proxy forwards **real client IP** for rate limits
- [ ] Optional WAF / edge rules for login surfaces
- [ ] Review CSP / HSTS reports; duplicate critical headers at CDN if policy requires ([`security-headers.ts`](../src/lib/security-headers.ts))

---

## F. Supply chain

- [ ] CI **`audit:ci`** ( **`high`**+ ) stays green on `main`
- [ ] Weekly **`npm-audit-report.yml`** artefact reviewed for **moderate/low** noise
- [ ] Dependabot/Renovate ownership — merge security PRs within SLA ([`.github/dependabot.yml`](../.github/dependabot.yml))

---

## G. Cron & email

- [ ] Configure **`cron-digest-email.yml`** secrets **`CRON_DIGEST_URL`** + **`CRON_SECRET`** **or** external scheduler equivalent
- [ ] Optional **`CRON_ALLOWED_IPS`** when scheduler egress is stable ([`cron-auth.ts`](../src/lib/cron-auth.ts))
- [ ] Publish SPF / DKIM / DMARC for **`SMTP_FROM`** domain ([`email-dns-authentication.md`](./email-dns-authentication.md)); bounce monitoring on

---

## H. Privacy & legal (Norway/EU context)

Use **[`vendor-dpa-checklist.md`](./vendor-dpa-checklist.md)** with counsel, then:

- [ ] Complete RoPA / lawful basis worksheet ([`ropa-lawful-basis-template.md`](./ropa-lawful-basis-template.md))
- [ ] Define retention & DSAR workflow ([`privacy-retention-and-erasure.md`](./privacy-retention-and-erasure.md))
- [ ] Breach process assigned

---

## I. Disaster recovery & incidents

- [ ] Platform rollback path rehearsed (previous image / slot) ([`disaster-recovery-runbooks.md`](./disaster-recovery-runbooks.md))
- [ ] Incident commander + comms templates chosen
- [ ] Optional game-day calendar

---

## J. Verification gate (staging → production)

After executing sections **A–I** on **staging**, repeat critical paths on **production** and record sign-off.

- [ ] Auth: sessions, password reset, invitations
- [ ] RBAC: each role blocked where expected
- [ ] Data: migrations + smoke queries
- [ ] Ops: `/api/health`, cron success, backups artefact or vendor UI
- [ ] Security: TLS, headers spot-check, no secrets in repo
- [ ] DR: rollback drill or tabletop approved

Optional UI smoke: **`PLAYWRIGHT_RUN=1`** — [`README.md`](../README.md).
