# Viewer portal — roadmap & status

Track enhancements for **VIEWER** users (read-heavy access: browse inventory, POs, projects; **no** wholesale financial or attendance dumps; limited writes).

**Statuses:** `Done` · `In progress` · `Not started` · `Deferred`

**Related:** [`portal-high-impact.md`](./portal-high-impact.md) · **`src/app/(dashboard)/dashboard/page.tsx`** (typical landing) · **`src/lib/rbac.ts`** · **`src/proxy.ts`** (`viewerBlockedWritePathname`)

---

## Read experience

| Item                                                                             | Status      | Notes                                                               |
| -------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| **Dashboard + browse catalogs (inventory, POs, projects, suppliers, customers)** | Done        | Viewer uses same authenticated app surfaces with server-side guards |
| **Global search (CmdK)**                                                         | Done        | Full discovery except policies enforced elsewhere                   |
| **Header notifications (+ `/me` if Viewer uses portal)**                         | Done        | Shared UX; unread counts wherever role can access `/me`             |
| **Curated “my watchlist” / pinned entities on dashboard**                        | Not started | Faster return to tracked SKUs/projects                              |
| **Explain stock / links to last movement summaries on product**                  | Not started | Reduces “why is quantity X?” escalations                            |
| **Read-only trend cards (movement velocity, backlog age)**                       | Not started | Charts only; export still gated                                     |

---

## Blocked mutations (parity with code)

| Item                                                                        | Status      | Notes                                                                                                      |
| --------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| **Edge block: inventory receive/new/edit paths**                            | Done        | `viewerBlockedWritePathname`                                                                               |
| **Edge block: `purchase-orders/new`, `projects/new`, customer create/edit** | Done        | Same helper                                                                                                |
| **Cannot record stock movements (server)**                                  | Done        | `canRecordStockMovement` excludes VIEWER                                                                   |
| **Restrict `/manager` for VIEWER (optional)**                               | Not started | Today `canAccessManagerHub` includes VIEWER — change policy explicitly if mgr UI should exclude reads-only |

---

## Exports & compliance

| Item                                         | Status      | Notes                                               |
| -------------------------------------------- | ----------- | --------------------------------------------------- |
| **Employees directory CSV**                  | Done        | VIEWER allowed per `canExportEmployeesDirectoryCsv` |
| **Financial CSVs blocked**                   | Done        | VIEWER forbidden for `canExportFinancialCsv`        |
| **Attendance team CSV blocked**              | Done        | VIEWER forbidden for `canExportAttendanceCsv`       |
| **Export audit trail (who downloaded what)** | Not started | Trust feature for auditors                          |

---

## How to use this doc

Same as [`staff-portal-roadmap.md`](./staff-portal-roadmap.md).
