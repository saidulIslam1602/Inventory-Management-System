# Manager portal — roadmap & status

Track enhancements for **MANAGER** users (approvals, team oversight, purchasing/receiving workflows, **`/manager`** hub).

**Statuses:** `Done` · `In progress` · `Not started` · `Deferred`

**Related:** [`portal-high-impact.md`](./portal-high-impact.md) · [`staff-portal-roadmap.md`](./staff-portal-roadmap.md) · **`src/app/(dashboard)/manager/page.tsx`** · **`src/lib/rbac.ts`** (`isManagementRole`, `canExportFinancialCsv`)

---

## Manager hub & workflows

| Item                                                  | Status | Notes                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/manager` overview page**                          | Done   | Central hub (PO context, transfers, receive helpers per current app)                                                                                                                                                                                                                                                                                                        |
| **PO workflow actions + receive tooling**             | Done   | Components under `src/components/manager/`                                                                                                                                                                                                                                                                                                                                  |
| **Transfer suggestions UX**                           | Done   | `manager-transfer-suggestions-table`                                                                                                                                                                                                                                                                                                                                        |
| **Global search / CmdK (full visibility)**            | Done   | No employee hide for MANAGER (`/api/search`)                                                                                                                                                                                                                                                                                                                                |
| **Notifications + digest tooling**                    | Done   | Shared header + cron patterns; aligns with prefs                                                                                                                                                                                                                                                                                                                            |
| **Decision queue inbox (sorted “needs you” actions)** | Done   | `buildManagerDecisionQueue()` + `ManagerDecisionQueueSection` on `/manager`; card `#manager-decision-inbox` merges exceptions, PO approvals, receiving backlog (dedup vs exception ids), capped transfer hints                                                                                                                                                              |
| **SLA / aging indicators on pending items**           | Done   | `manager-aging.ts` tiers + `ManagerPendingAgingBadge` on `/manager` PO approval + receiving cards; left accent rows; decision inbox shows tier badges for PO/receive rows                                                                                                                                                                                                   |
| **Manager saved views (team filters)**                | Done   | `?location=` branch scope + `ManagerHubTeamBar` (`SavedViewsBar` `storageId=manager-hub`, per-user `scopeKey`); queries in `manager-overview` accept optional branch; `getLowStockSkusAtBranch` when scoped                                                                                                                                                                 |
| **One-click escalate / comment on exceptions**        | Done   | `POAuditEventKind.ESCALATION_NOTE` + `addPurchaseOrderEscalationNote`; manager exception rows with PO → **Log note** dialog; PO detail → escalation card with optional **line gap** (`formatPurchaseOrderLineGapSummary`) appended to audit text                                                                                                                            |
| **Email/push escalation for overdue approvals**       | Done   | `NotificationType.PO_APPROVAL_OVERDUE`; prefs `instant.poApprovalEscalation` (default on) + `emailApprovalEscalation` (opt-in); `runApprovalEscalationInAppNotifications` + `runApprovalEscalationEmails` from `GET /api/cron/digest-email` (CRON_SECRET); threshold = `AppSettings.exceptionStaleSubmitDays`; digest text lists overdue POs; 24h in-app de-dup per user+PO |

---

## Data & exports

| Item                                                | Status | Notes                                                                        |
| --------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| **Financial CSV exports (PO, movements, projects)** | Done   | `canExportFinancialCsv` — ADMIN \| MANAGER \| STAFF                          |
| **Attendance CSV (org-wide / filtered)**            | Done   | `canExportAttendanceCsv`; STAFF differs (self-scope)                         |
| **Employees directory CSV**                         | Done   | ADMIN \| MANAGER \| VIEWER (`canExportEmployeesDirectoryCsv`; STAFF blocked) |

---

## Access & routing

| Item                                                     | Status | Notes                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MANAGER reaches `/employees`, `/reports`, `/manager`** | Done   | STAFF blocked at proxy; MANAGER unaffected                                                                                                                                                                                                                                |
| **MANAGER reaches `/settings` for non-admin features**   | Done   | `canAccessSettingsPage` in `proxy.ts` (ADMIN \| MANAGER \| VIEWER; STAFF → dashboard); `/settings` page: managers/viewers see org reference + read-only threshold card; `ExceptionThresholdsForm` remains admin-only (action unchanged); sidebar hides Settings for STAFF |

---

## How to use this doc

Same as [`staff-portal-roadmap.md`](./staff-portal-roadmap.md) — bump **Status** and **Notes** as you ship or defer work.
