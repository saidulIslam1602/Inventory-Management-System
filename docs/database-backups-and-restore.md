# Database backups & restore — Aqila IMS

PostgreSQL is the system of record (`DATABASE_URL`, Prisma). This runbook covers **logical backups**, **managed-provider defaults**, and a **restore drill** your team should execute on a schedule.

**Related:** [`AGENTS.md`](../AGENTS.md) (migrations), [`production-readiness.md`](./production-readiness.md) tracker **5**, [`go-live-execution-checklist.md`](./go-live-execution-checklist.md) § C, workflow [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml), [`disaster-recovery-runbooks.md`](./disaster-recovery-runbooks.md) (when DB restore follows an incident), helper [`scripts/pg-backup.sh`](../scripts/pg-backup.sh), [`secrets-vault-and-github-mapping.md`](./secrets-vault-and-github-mapping.md).

---

## What you are protecting

- Operational data: inventory, movements, POs, projects, attendance, notifications, audit tables, Auth.js-linked users/sessions (depending on adapter usage — this app uses **JWT sessions**, but **users/password hashes** live in Postgres).

**Recovery-point objective (RPO)** and **recovery-time objective (RTO)** are business choices — write them down (e.g. “≤ 24 h data loss acceptable”, “restore within 4 h”).

---

## Managed PostgreSQL (recommended for production)

Use your vendor’s **automated backups** and **point-in-time recovery (PITR)** where offered:

| Provider (examples)                                           | Action                                                                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Neon, Supabase, RDS, Azure Database for PostgreSQL, Cloud SQL | Enable automated backups; set retention; note backup window/timezone; test **restore to a new instance** yearly or quarterly. |

**Operational checklist**

- [ ] Backups enabled + retention meets policy
- [ ] Encryption at rest (usually default)
- [ ] Access to restore UI/API restricted
- [ ] Restored DB gets its own `DATABASE_URL`; run **`npm run db:migrate:deploy`** only if schema behind backups — normally restoring snapshot restores schema + `_prisma_migrations` together

---

## Self-hosted / VM / Docker Compose

Compose defines Postgres **`postgres:16-alpine`** and volume **`postgres_data`** (`docker/docker-compose.yml`). **A volume alone is not a backup strategy** — copy **logical dumps** off-host.

### Logical backup (`pg_dump`)

Requires **`pg_dump`** client installed where you run the command (often CI runner or bastion).

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"
./scripts/pg-backup.sh
```

Writes **`./backups/aqila_ims-<timestamp>.dump`** (custom format). Override path:

```bash
./scripts/pg-backup.sh /secure/path/prod.dump
```

Custom format suits **`pg_restore`** with parallel jobs later.

### One-shot via Docker (Compose DB service)

From repo root, with Compose stack running:

```bash
docker compose -f docker/docker-compose.yml exec -T db \
  pg_dump -U aqila_user -d aqila_ims --format=custom \
  > "./backups/manual-$(date +%Y%m%d-%H%M%S).dump"
```

Ensure `./backups` exists on the host; redirect captures stdout.

### Scheduling & retention

- Run dumps **daily** (or more often during heavy change periods).
- Retain multiple generations **off the DB server** (object storage, separate region/VNet).
- Encrypt archives at rest (e.g. SSE-S3, GPG) when storing outside trusted infra.

---

## GitHub Actions — logical dumps + durable storage

Workflow **[`db-backup.yml`](../.github/workflows/db-backup.yml)** runs **`scripts/pg-backup.sh`** and uploads a short-lived **artifact**. For **real retention**, configure repository **Variables** and **Secrets**:

| Variable                      | Purpose                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **`BACKUP_SCHEDULE_ENABLED`** | Set to **`true`** to allow the daily **`schedule`** trigger (manual dispatch always runs).                 |
| **`BACKUP_UPLOAD`**           | **`azure`**, **`s3`**, **`azure+s3`**, or unset — controls optional cloud upload steps after the artifact. |
| **`AZURE_BACKUP_CONTAINER`**  | Blob container name (must exist). Required when upload includes **`azure`**.                               |
| **`S3_BACKUP_BUCKET`**        | Bucket name. Required when upload includes **`s3`**.                                                       |
| **`S3_BACKUP_PREFIX`**        | Optional object key prefix.                                                                                |
| **`AWS_BACKUP_REGION`**       | e.g. **`eu-north-1`**. Required when upload includes **`s3`**.                                             |

| Secret                                                              | Purpose                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **`DATABASE_BACKUP_URL`**                                           | Read-only Postgres URL for **`pg_dump`**.                             |
| **`AZURE_BACKUP_STORAGE_CONNECTION_STRING`**                        | Storage account connection string with write access to the container. |
| **`AWS_BACKUP_ACCESS_KEY_ID`** / **`AWS_BACKUP_SECRET_ACCESS_KEY`** | IAM principal limited to **`s3:PutObject`** on the backup prefix.     |

Blob / object keys include UTC timestamps and **`github.run_id`** for uniqueness. Apply **lifecycle rules** (tiering, expiry) on the bucket or storage account.

---

## Restore procedure (logical backup)

**Always practise on a throwaway DB first.**

1. Create or choose empty Postgres database **or** drop/recreate schema-only DB **after ownership/legal approval** for destructive tests.
2. Stop application instances pointing at the target DB **or** point traffic away until restore completes.
3. Restore:

```bash
pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --jobs=4 ./path/to/backup.dump
```

Adjust **`--jobs`** for CPU; **`--clean`** drops conflicting objects before restore (destructive).

4. Set **`DATABASE_URL`** on app instances to the restored database (if different connection).
5. Start app; verify **`GET /api/health`** returns **200**.
6. Spot-check: login, dashboard counts vs expectation; **`SELECT * FROM "_prisma_migrations"` ORDER BY finished_at DESC LIMIT 5;**

If restoring onto **fresh Postgres without migration history** but tables exist from old tooling, follow **`AGENTS.md`** baseline / **`migrate resolve`** guidance — prefer restores from backups taken **after** migrations were deployed consistently.

---

## Restore drill (calendar template)

Do **at least annually**; preferably **quarterly**.

| Field              | Record                         |
| ------------------ | ------------------------------ |
| Date               |                                |
| Owner              |                                |
| Environment used   | staging clone / disposable DB  |
| Backup artefact ID | file path / vendor snapshot ID |
| Steps followed     | link or pasted checklist       |
| Outcome            | pass / fail + notes            |
| Time to restore    |                                |

Tick **`production-readiness.md`** tracker **5** drill checkbox **only after** a completed drill row exists.

---

## Troubleshooting

- **`pg_dump: aborting because of server version mismatch`** — upgrade client tools or use a matching Postgres container for dumps.
- **Permission denied writing `./backups`** — create directory or choose writable path.
- **Large DB / long dumps** — use **`--format=custom`** + compress archives (`gzip`) when piping plaintext `--format=plain`.
