# Secrets vault & GitHub mapping — Aqila IMS

Step-by-step patterns for **moving secrets out of git** and wiring **GitHub Actions** / **runtime hosts**. Adjust names to your cloud provider (Azure, AWS, GCP).

**Related:** [`.env.example`](../.env.example), [`secrets-and-config.md`](./secrets-and-config.md), [`go-live-execution-checklist.md`](./go-live-execution-checklist.md) § A, [`database-backups-and-restore.md`](./database-backups-and-restore.md) (backup workflow secrets).

---

## 1. GitHub Actions — encrypted secrets & environments

| Host / workflow                                    | Suggested secret names                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Runtime (your PaaS loads these same logical names) | Mirror `.env.example` keys (`DATABASE_URL`, `AUTH_SECRET`, …).                                                              |
| DB backup workflow                                 | `DATABASE_BACKUP_URL`, `AZURE_BACKUP_STORAGE_CONNECTION_STRING`, `AWS_BACKUP_ACCESS_KEY_ID`, `AWS_BACKUP_SECRET_ACCESS_KEY` |
| Cron digest workflow                               | `CRON_DIGEST_URL`, `CRON_SECRET`                                                                                            |

**Environment protection (recommended for production):**

1. Repo → **Settings** → **Environments** → create **`production`** (and **`staging`**).
2. Add **required reviewers** before deploy jobs run.
3. Scope secrets per environment so staging cannot read production DB URLs.

**Rotation:** update the secret value → redeploy / restart app instances → revoke old DB/SMTP passwords at the provider.

---

## 2. Azure — Key Vault references on Container Apps / App Service

**Goal:** containers receive env vars from Key Vault without baking secrets into images.

1. Create **Key Vault** in the same region as the app.
2. Store secrets (`database-url`, `auth-secret`, …) as **Secrets** in the vault.
3. Enable **managed identity** on the Container App (system-assigned or user-assigned).
4. Grant that identity **Key Vault Secrets User** (read) on the vault.
5. In Container Apps → **Secrets** / env configuration, add **Key Vault reference** URIs, or set env vars to `@Microsoft.KeyVault(SecretUri=…)` style references per [Azure docs — Key Vault references](https://learn.microsoft.com/azure/app-service/app-service-key-vault-references).

**Backup workflow:** store **`AZURE_BACKUP_STORAGE_CONNECTION_STRING`** in GitHub **Secrets** (not Key Vault) unless you use OIDC + Azure federated credentials to pull from vault at workflow runtime.

---

## 3. AWS — Secrets Manager / Parameter Store

1. Store JSON or individual secrets (`DATABASE_URL`, …) in **Secrets Manager**.
2. Attach an IAM role to the runtime task / Lambda / ECS task with **`secretsmanager:GetSecretValue`** scoped to those ARNs.
3. Inject into container **`secrets`** section (ECS) or platform-specific binding.

**GitHub → AWS:** prefer **OIDC** (`aws-actions/configure-aws-credentials` with `role-to-assume`) over long-lived **`AWS_ACCESS_KEY_ID`** for deploy pipelines; keep **`AWS_BACKUP_*`** keys narrowly scoped to **`s3:PutObject`** on the backup prefix only.

---

## 4. Verification

- [ ] No `.env` with real values committed; `.gitignore` contains `.env`.
- [ ] Production **`AUTH_SECRET`** / **`CRON_SECRET`** generated with a CSPRNG (`openssl rand -base64 32`).
- [ ] Break-glass: document **who** can read prod secrets and **how** access is revoked when someone leaves.

---

## Related workflows

- [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml)
- [`.github/workflows/cron-digest-email.yml`](../.github/workflows/cron-digest-email.yml)
