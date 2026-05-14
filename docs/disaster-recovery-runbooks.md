# Disaster recovery & incident runbooks — Aqila IMS

Operational playbook for **restoring service**, **controlling blast radius**, and **break-glass access**. Not legal advice; align steps with your incident process and change-management rules.

**Related:** [`production-readiness.md`](./production-readiness.md) tracker **15**, [`database-backups-and-restore.md`](./database-backups-and-restore.md), [`secrets-and-config.md`](./secrets-and-config.md), [`application-observability.md`](./application-observability.md) (`/api/health`, **`revision`**), cron gate [`src/lib/cron-auth.ts`](../src/lib/cron-auth.ts), Docker startup [`docker/entrypoint.sh`](../docker/entrypoint.sh).

---

## 1. Clarify the failure mode

| Symptom                                        | Likely focus                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Bad deploy (502/5xx, crashes, wrong behaviour) | Roll back **application** image / revision first                                                            |
| Cron spam, duplicate emails, scheduler bug     | **Disable cron** triggers before rollback if jobs worsen state                                              |
| DB unavailable, corrupt migration, bad data    | **Stop writes**, use backup / PITR ([`database-backups-and-restore.md`](./database-backups-and-restore.md)) |
| Locked out of admin UI                         | **Break-glass** (§6)                                                                                        |

Record **start time**, **on-call**, and **customer-facing owner** per your process.

---

## 2. Health & revision

- **`GET /api/health`** — expects **200** when Postgres answers `SELECT 1`; **503** when the DB is unreachable ([`src/app/api/health/route.ts`](../src/app/api/health/route.ts)).
- Optional JSON **`revision`** — set via **`APP_VERSION`** or common CI env vars ([`deployment-meta.ts`](../src/lib/deployment-meta.ts)). Use it to confirm which build is live after a rollback or rollout.

---

## 3. Disable cron / background HTTP triggers

Digest email runs on **`GET /api/cron/digest-email`** with **`Authorization: Bearer <CRON_SECRET>`** and optional IP allowlist (**`CRON_ALLOWED_IPS`**). See [`cron-auth.ts`](../src/lib/cron-auth.ts).

**Fastest ways to stop automated calls**

1. **Pause or delete** the scheduler job (GitHub Actions `workflow_dispatch` only, Vercel Cron, Kubernetes `CronJob`, platform cron).
2. **Rotate `CRON_SECRET`** in the secret manager and update only when you intentionally re-enable jobs — existing schedulers get **401** until updated with the new bearer token ([`digest-email/route.ts`](../src/app/api/cron/digest-email/route.ts)).
3. **Emergency:** unset **`CRON_SECRET`** — the cron route returns **503** (`not_configured`) for every caller, so jobs stop having effect even if something still pings the URL. Production boot allows **`CRON_SECRET` to be unset** ([`validate-production-env.ts`](../src/lib/validate-production-env.ts)); only a **short** secret when set is rejected.

Prefer (1) or (2) so you do not leave production permanently without digest/escalation unless that is an explicit decision.

---

## 4. Roll back an application deployment

There is **no in-app “rollback” button**. Use your platform:

| Platform pattern                  | Action                                                                    |
| --------------------------------- | ------------------------------------------------------------------------- |
| Container registry + orchestrator | Redeploy **previous image digest**; scale down failed revision            |
| Docker Compose                    | Set **`image:`** tag to last known good build; **`docker compose up -d`** |
| PaaS slots / traffic split        | Swap traffic to previous slot or revision                                 |

**Verify:** **`GET /api/health`** returns **200** and **`revision`** matches the intended build.

### Migrations vs rollback

[`docker/entrypoint.sh`](../docker/entrypoint.sh) runs **`prisma migrate deploy`** before **`node server.js`**. That means:

- Rolling **back** the container **does not** undo migrations already applied to Postgres.
- If a **bad migration** shipped, recovery is usually: restore DB from backup / PITR to before the migration, **or** ship a **forward-fix** migration after incident review — not “deploy old image only.”

Coordinate with [`AGENTS.md`](../AGENTS.md) migration rules and tracker **5** restore drills.

---

## 5. Database recovery (high level)

Follow **`database-backups-and-restore.md`** end-to-end: stop traffic or writes, restore, repoint **`DATABASE_URL`**, bring app up, **`GET /api/health`**, spot-check login and critical flows.

After restore, confirm **`_prisma_migrations`** matches expectations if you rely on vendor snapshots taken mid-deploy.

---

## 6. Maintenance messaging (not a hard outage mode)

The app supports a **full-width maintenance banner** (planned downtime messaging) driven by **`AppSettings`** — configured from **Settings** in the dashboard (**ADMIN** only for admin tabs). Implementation: [`maintenance-banner-server.ts`](../src/lib/maintenance-banner-server.ts), dashboard layout.

**Important:** the banner is **informational**. It does **not** block HTTP traffic or writes. For a true read-only window, use **infrastructure** (LB maintenance page, IP allowlist, separate static page) or freeze processes by policy.

---

## 7. Break-glass admin access

Prefer **normal recovery** first: another **ADMIN** user, **forgot-password** email (if SMTP healthy), or **invitation** flow from an existing admin.

If all UI paths are exhausted and **database access** is approved:

1. Identify the **`users`** row (`email` unique).
2. Set **`role`** to **`ADMIN`** (enum **`UserRole`** in Postgres) and **`isActive`** to **`true`** for that row.

Example (adjust email; run only with backups / change approval):

```sql
UPDATE users
SET role = 'ADMIN', "isActive" = true, "updatedAt" = NOW()
WHERE email = 'trusted.ops@example.com';
```

Then sign in and **reset password** via normal flows if needed. Sensitive actions may appear in **`AuditEvent`** / settings audit — review after recovery.

**Avoid** sharing generic seed credentials (`prisma/seed.ts`) in production; seeds are for development.

---

## 8. Post-incident checklist

- [ ] Root cause note + timeline (internal)
- [ ] Cron/schedulers re-enabled with correct **`CRON_SECRET`** / IPs
- [ ] **`/api/health`** + spot-check critical paths
- [ ] Update **`production-readiness.md`** tracker **5** / **15** if drills or gaps were exposed
