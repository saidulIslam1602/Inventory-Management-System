# Secrets & configuration — Aqila IMS

Operational guide for **environment variables** and **where secrets live**. Complements [`.env.example`](../.env.example), [**production-readiness.md**](./production-readiness.md), [**go-live-execution-checklist.md**](./go-live-execution-checklist.md) tracker **A**, [**privacy-retention-and-erasure.md**](./privacy-retention-and-erasure.md), [**disaster-recovery-runbooks.md**](./disaster-recovery-runbooks.md) (rotating **`CRON_SECRET`**, incidents).

---

## Principles

1. **Never commit real secrets** — only [`.env.example`](../.env.example) (placeholders) belongs in git.
2. **Production values live in a secret manager or host-defined secrets** — not copy-pasted into long-lived files on disk without encryption.
3. **Rotate** after people leave, suspected leaks, or on a calendar (e.g. annual `AUTH_SECRET`, quarterly `CRON_SECRET`).
4. **Least privilege** — DB users for the app should not be superusers; SMTP credentials scoped to send-only if possible.

---

## Required variables (summary)

| Variable                                              | Required          | Notes                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | Yes               | Postgres URL for **app runtime** (`pg` pool + Prisma). Often a pooler in production; see [`database-connection-pooling.md`](./database-connection-pooling.md).                                                                                                        |
| `DATABASE_DIRECT_URL`                                 | Optional          | **Direct** Postgres URL for **`prisma migrate`** when `DATABASE_URL` is transaction-pooled. Falls back to `DATABASE_URL` when unset ([`prisma.config.ts`](../prisma.config.ts)).                                                                                      |
| `DATABASE_POOL_MAX` / `_IDLE_MS` / `_CONN_TIMEOUT_MS` | Optional          | Tune [`db-pool-config.ts`](../src/lib/db-pool-config.ts); defaults are safe for single-instance dev.                                                                                                                                                                  |
| `AUTH_SECRET`                                         | Yes (prod)        | **≥ 32 characters.** `openssl rand -base64 32`                                                                                                                                                                                                                        |
| `NEXTAUTH_URL` or `AUTH_URL`                          | Yes (prod)        | Public origin Auth.js uses for callbacks / absolute links; **HTTPS** in real deployments (http localhost allowed for smoke tests). Invitation emails prefer `AUTH_URL` then `NEXTAUTH_URL`.                                                                           |
| `CRON_SECRET`                                         | If cron runs      | Protects `GET /api/cron/digest-email`. **≥ 24 characters** when set in production. Strong random string; unique per environment.                                                                                                                                      |
| `CRON_ALLOWED_IPS`                                    | Optional          | Comma-separated **exact** client IPs (see [`cron-auth`](../src/lib/cron-auth.ts)); compared to `x-forwarded-for` first hop / `x-real-ip`. Omit to allow any caller that has the bearer secret (still use TLS).                                                        |
| `SMTP_*`                                              | Optional          | Needed for digest / password-reset / invitation mail. DNS: [`email-dns-authentication.md`](./email-dns-authentication.md).                                                                                                                                            |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional          | Enables **distributed** auth rate limits ([`auth-rate-limit-backend.ts`](../src/lib/auth-rate-limit-backend.ts)); omit to use process-local counters only.                                                                                                            |
| `OTEL_ENABLED`                                        | Optional          | Set **`true`** with an OTLP collector to export traces ([`node-otel.ts`](../src/lib/node-otel.ts)). In **production**, **`OTEL_EXPORTER_OTLP_ENDPOINT`** must be set explicitly and must use **`https://`** unless the collector is on **`localhost` / `127.0.0.1`**. |
| `OTEL_EXPORTER_OTLP_ENDPOINT`                         | With OTEL in prod | OTLP **HTTP** traces URL (usually ends with **`/v1/traces`**).                                                                                                                                                                                                        |
| `OTEL_EXPORTER_OTLP_HEADERS`                          | Optional          | Comma-separated **`Authorization=Bearer%20…`** style headers for SaaS collectors ([`otlp-env.ts`](../src/lib/otlp-env.ts)).                                                                                                                                           |
| `OTEL_SERVICE_NAME`                                   | Optional          | Defaults to **`aqila-ims`**.                                                                                                                                                                                                                                          |
| `PLAYWRIGHT_BASE_URL` / `PLAYWRIGHT_RUN`              | Optional          | UI smoke tests only ([`README.md`](../README.md)); never required in production servers.                                                                                                                                                                              |

At **production** startup, [`validate-production-env`](../src/lib/validate-production-env.ts) (via [`instrumentation.ts`](../src/instrumentation.ts)) asserts `AUTH_SECRET` length and HTTPS public URL rules. When **`CRON_SECRET` is set**, it must be **≥ 24 characters** or the process refuses to boot (avoid weak bearer tokens).

---

## Where to store secrets

| Environment                  | Suggested approach                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local dev**                | `.env` (gitignored), copied from `.env.example`.                                                                                            |
| **Production vault mapping** | [`secrets-vault-and-github-mapping.md`](./secrets-vault-and-github-mapping.md) — Key Vault / Secrets Manager / GitHub Environment patterns. |
| **Docker Compose**           | `.env` next to compose file, or shell exports; do not commit.                                                                               |
| **VPS / systemd**            | `/etc/…` env file with root-only permissions, or Docker `--env-file` from protected path.                                                   |
| **GitHub Actions**           | Encrypted **Secrets** and optional **Environments** with approval gates.                                                                    |
| **Kubernetes**               | `Secret` resources or external secret operator → mounted env.                                                                               |

Document **who can read** production secrets (break-glass procedure in your internal wiki).

---

## Rotation checklist

Use after incidents or on schedule:

1. Generate new `AUTH_SECRET` → update secret store → **restart all app instances** (sessions invalidate).
2. Generate new `CRON_SECRET` → update scheduler `Authorization: Bearer …` → verify `/api/cron/digest-email` returns 200 once.
3. `SMTP_PASS` / DB password → update provider + connection string → restart app → smoke login + one outbound email.
4. Remove old credentials from backup configs and chat logs.

---

## Related code

- Cron auth: [`src/lib/cron-auth.ts`](../src/lib/cron-auth.ts) + [`src/app/api/cron/digest-email/route.ts`](../src/app/api/cron/digest-email/route.ts)
- DB URL + pool: [`src/lib/db.ts`](../src/lib/db.ts), [`src/lib/db-pool-config.ts`](../src/lib/db-pool-config.ts); [`database-connection-pooling.md`](./database-connection-pooling.md)
- SMTP / mail transport: [`src/lib/email/nodemailer-transport.ts`](../src/lib/email/nodemailer-transport.ts); [`email-dns-authentication.md`](./email-dns-authentication.md)
- Invitation base URL: [`src/lib/actions/user-invitations.ts`](../src/lib/actions/user-invitations.ts) (`AUTH_URL` / `NEXTAUTH_URL`)
- HTTPS, proxies, cookies: [`https-and-cookies.md`](./https-and-cookies.md)
- Backups / restore: [`database-backups-and-restore.md`](./database-backups-and-restore.md) (personal data in dumps — see [`privacy-retention-and-erasure.md`](./privacy-retention-and-erasure.md))
- Logging / correlation IDs: [`logging-and-correlation.md`](./logging-and-correlation.md)
- SLOs / health revision / APM notes: [`application-observability.md`](./application-observability.md)
