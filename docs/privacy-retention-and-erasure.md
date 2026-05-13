# Privacy, retention, and erasure — Aqila IMS

Operational runbook for **personal data** held in Aqila IMS (employees, users, attendance, notifications, audit metadata, and related exports).  
This document is **not legal advice**. GDPR and Norwegian employment / bookkeeping rules depend on your sector, agreements, and counsel — assign a **data controller**, **DPO** (where required), and documented **lawful bases**.

**Related:** [`production-readiness.md`](./production-readiness.md) tracker **14**, [`ropa-lawful-basis-template.md`](./ropa-lawful-basis-template.md), [`secrets-and-config.md`](./secrets-and-config.md), [`database-backups-and-restore.md`](./database-backups-and-restore.md) (backups contain the same personal data), [`disaster-recovery-runbooks.md`](./disaster-recovery-runbooks.md) (restore timing vs DSAR), [`logging-and-correlation.md`](./logging-and-correlation.md) (application logs may include ids / IPs).

---

## 1. Personal data inventory (schema-oriented)

| Topic                         | Prisma models (see [`schema.prisma`](../prisma/schema.prisma))                                                | Typical content                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Accounts & sessions**       | `User`, `Session`, `Account`, `VerificationToken`                                                             | Name, email, password hash, role, notification prefs JSON, OAuth tokens (if used) |
| **HR / directory**            | `Employee`                                                                                                    | Name, phone, address, nationality, photo URL, employment metadata                 |
| **Attendance & planning**     | `Attendance`, `Shift`                                                                                         | Dates, check-in/out, hours, notes                                                 |
| **In-app alerts**             | `Notification`                                                                                                | Title, message, read state, user association                                      |
| **Security / compliance log** | `AuditEvent`                                                                                                  | Actor user id/email, action, IP, user-agent, summary, metadata JSON               |
| **Auth artefacts**            | `UserInvitation`, `PasswordResetOtp`                                                                          | Email (normalized), hashed tokens/codes, timestamps                               |
| **Operational traceability**  | `StockMovement` (optional `userId`), `PurchaseOrder` (`createdById`), `PurchaseOrderAuditLog` (`actorUserId`) | Links users to inventory and procurement actions                                  |
| **CRM-lite**                  | `Customer`, `Project` (`clientName`, `clientPhone`)                                                           | May identify natural persons when clients are individuals                         |

Low‑risk / mostly non-personal: products, stock quantities, suppliers (unless sole traders), locations.

---

## 2. Access and portability (export)

**In-app / API (authenticated, RBAC-enforced)** — CSV exports under `GET /api/export/*`:

| Export              | Route                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| Attendance          | [`/api/export/attendance`](../src/app/api/export/attendance/route.ts)           |
| Employees directory | [`/api/export/employees`](../src/app/api/export/employees/route.ts)             |
| Projects            | [`/api/export/projects`](../src/app/api/export/projects/route.ts)               |
| Purchase orders     | [`/api/export/purchase-orders`](../src/app/api/export/purchase-orders/route.ts) |
| Stock movements     | [`/api/export/stock-movements`](../src/app/api/export/stock-movements/route.ts) |

Exports are **not** a full GDPR “single package” dump; they cover operational datasets. For a subject-access request, combine relevant CSVs (and optional SQL snapshots of `users`, `employees`, `notifications`, `audit_events` for that subject) under your legal review.

**Audit UI:** Admin-facing audit trail at route **`/settings/audit-log`** (see app router under `src/app/(dashboard)/settings/audit-log/`).

---

## 3. Retention (policy placeholders)

Define **per category** in your internal register (examples only — adjust with counsel):

| Category                     | Direction                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Attendance / shifts**      | Often tied to payroll and working-time rules; retain while employment lasts + statutory limitation periods  |
| **Notifications**            | Short TTL acceptable if no legal need; app stores rows until deleted                                        |
| **Audit events**             | Often retained for security investigations; balance against minimisation                                    |
| **Sessions / OTP / invites** | Sessions expire per Auth.js; OTP rows time-bound; purge revoked/expired invitations periodically if desired |
| **Backups**                  | Retention of backups = retention of personal data — align backup policy with this register                  |

The codebase does **not** auto-purge old rows by default; scheduling deletes or anonymisation jobs is **operator-owned**.

---

## 4. Erasure / restriction (“right to be forgotten”) — constraints

Deleting a **`User`** is constrained by **foreign keys** and **business traceability**:

- **`PurchaseOrder.createdById`** is required — you cannot hard-delete a user who created POs without **reassigning** orders or archiving differently.
- **`StockMovement.userId`** is optional — movements may still reference a user when set.
- **`AuditEvent`** is append-only by design — often **anonymise** (`actorUserId` null, redact `actorEmail` / metadata) rather than delete rows, unless law and policy allow removal.

**Practical patterns** (choose per legal advice):

1. **Offboard:** set `User.isActive = false`, revoke sessions, disable login.
2. **Employee exit:** update `Employee.isActive`, retain statutory HR records off-system or minimised in DB per policy.
3. **Erasure request:** after legal review, **anonymise** identifiable fields on `User`/`Employee`, redact related `AuditEvent` actor fields, delete `Notification` rows, and resolve FK blockers (reassign `createdById` to a system service account, or pseudonym user).

Always perform destructive changes on a **staging copy** first; take a **backup** before production edits; document the ticket id and approver.

---

## 5. Checklist (operator)

- [ ] Maintain a **records of processing** (RoPA) listing Purposes, Categories, Recipients, Transfers, Retention.
- [ ] Align **backup retention** ([`database-backups-and-restore.md`](./database-backups-and-restore.md)) with erasure requests (restore + delete cycle if needed).
- [ ] Train admins: exports go through **`/api/export/*`** and audit log — avoid ad-hoc prod DB copies without classification.
- [ ] Define **breach** notification steps (who calls DPA within 72h where applicable).

---

## 6. Related code (starting points)

- Auth users: [`src/lib/auth.ts`](../src/lib/auth.ts), [`record-event.ts`](../src/lib/audit/record-event.ts)
- Export RBAC: [`src/lib/rbac.ts`](../src/lib/rbac.ts) + route handlers under [`src/app/api/export/`](../src/app/api/export/)
