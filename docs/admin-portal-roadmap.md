# Admin portal — roadmap & status

Track enhancements for **ADMIN** users (org configuration, policy thresholds, integrations, **`/settings`**, destructive or wide-blast capabilities).

**Statuses:** `Done` · `In progress` · `Not started` · `Deferred`

**Related:** [`portal-high-impact.md`](./portal-high-impact.md) · **`src/app/(dashboard)/settings/page.tsx`** · **`src/lib/rbac.ts`** (`canAccessAdminSettings` for mutations; `canAccessSettingsPage` for route) · **`src/proxy.ts`** (`/settings` for ADMIN \| MANAGER \| VIEWER)

---

## Settings & policy

| Item                                                        | Status      | Notes                                                                                           |
| ----------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| **`/settings` admin-only edits; route for mgr/viewer read** | Done        | Edge: `canAccessSettingsPage`; threshold form + `updateExceptionThresholdSettings` remain ADMIN |
| **Exception thresholds / app settings UX**                  | Done        | `exception-thresholds-form`, `src/lib/actions/app-settings.ts`                                  |
| **Notification prefs / infrastructure (SMTP digest)**       | Done        | Env + cron; surfaced via user prefs where applicable                                            |
| **Role invitation / SSO / SCIM**                            | Not started | If you expose admin user provisioning beyond seed                                               |
| **Feature flags per environment**                           | Not started | Toggle modules without redeploy                                                                 |
| **Maintenance window banner**                               | Not started | Planned downtime messaging                                                                      |

---

## Governance & audits

| Item                                                          | Status      | Notes                                                                        |
| ------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| **All export types permitted where policy applies**           | Done        | ADMIN inherits financial + attendance + roster exports via `rbac.ts` helpers |
| **Audit log UI (who changed settings / sensitive exports)**   | Not started | Start with append-only events table                                          |
| **Data quality consoles (duplicate customers, orphan links)** | Not started | Guided cleanup lists                                                         |

---

## Escalated access

| Item                                                 | Status | Notes                        |
| ---------------------------------------------------- | ------ | ---------------------------- |
| **Full `/manager`, `/employees`, `/reports` access** | Done   | ADMIN is never STAFF-blocked |

---

## How to use this doc

Same as [`staff-portal-roadmap.md`](./staff-portal-roadmap.md).
