# Admin portal — roadmap & status

Track enhancements for **ADMIN** users (org configuration, policy thresholds, integrations, **`/settings`**, destructive or wide-blast capabilities).

**Statuses:** `Done` · `In progress` · `Not started` · `Deferred`

**Related:** [`portal-high-impact.md`](./portal-high-impact.md) · **`src/app/(dashboard)/settings/page.tsx`** · **`src/lib/rbac.ts`** (`canAccessAdminSettings` for mutations; `canAccessSettingsPage` for route) · **`src/proxy.ts`** (`/settings` for ADMIN \| MANAGER \| VIEWER)

---

## Settings & policy

| Item                                                        | Status            | Notes                                                                                                                                                                                           |
| ----------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/settings` admin-only edits; route for mgr/viewer read** | Done              | Edge: `canAccessSettingsPage`; threshold form + `updateExceptionThresholdSettings` remain ADMIN                                                                                                 |
| **Exception thresholds / app settings UX**                  | Done              | `exception-thresholds-form`, `src/lib/actions/app-settings.ts`                                                                                                                                  |
| **Notification prefs / infrastructure (SMTP digest)**       | Done              | Env + cron; surfaced via user prefs where applicable                                                                                                                                            |
| **Role invitation / SSO / SCIM**                            | Done (invite MVP) | Admin email invitations: `/settings` → **Invite users**, `UserInvitation` + `/invite/[token]`. SMTP required in production; dev fallback shows copyable link. **SSO / SCIM** still not started. |
| **Feature flags per environment**                           | Done              | `featureFlags` on `AppSettings`; **Feature flags** card on `/settings` (ADMIN); sidebar + segment layouts + `/api/search` respect flags.                                                        |
| **Maintenance window banner**                               | Done              | `app_settings` banner fields; **Maintenance window banner** on `/settings`; `(auth)/layout` + dashboard `SidebarInset` render bar; optional schedule window.                                    |

---

## Governance & audits

| Item                                                          | Status | Notes                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **All export types permitted where policy applies**           | Done   | ADMIN inherits financial + attendance + roster exports via `rbac.ts` helpers                                                                                                                                                                         |
| **Audit log UI (who changed settings / sensitive exports)**   | Done   | `AuditEvent` model; `/settings/audit-log` (ADMIN); logs settings, invites, password reset/change, CSV exports, employee/customer saves.                                                                                                              |
| **Data quality consoles (duplicate customers, orphan links)** | Done   | ADMIN **`/settings/data-quality`**: **scorecard** (rule codes, DAMA dimensions, severity, pass/fail), snapshot time + methodology version; deterministic duplicate detection; drill-down queues with links. Methodology/limitations card for audits. |

---

## Escalated access

| Item                                                 | Status | Notes                        |
| ---------------------------------------------------- | ------ | ---------------------------- |
| **Full `/manager`, `/employees`, `/reports` access** | Done   | ADMIN is never STAFF-blocked |

---

## How to use this doc

Same as [`staff-portal-roadmap.md`](./staff-portal-roadmap.md).
