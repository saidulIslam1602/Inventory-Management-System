# Viewer portal — roadmap & status

Track enhancements for **VIEWER** users (read-heavy access: browse inventory, POs, projects; **no** wholesale financial or attendance dumps; limited writes).

**Statuses:** `Done` · `In progress` · `Not started` · `Deferred`

**Related:** [`portal-high-impact.md`](./portal-high-impact.md) · **`src/app/(dashboard)/dashboard/page.tsx`** (typical landing) · **`src/lib/rbac.ts`** · **`src/proxy.ts`** (`viewerBlockedWritePathname`)

---

## Read experience

| Item                                                                             | Status | Notes                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard + browse catalogs (inventory, POs, projects, suppliers, customers)** | Done   | Viewer uses same authenticated app surfaces with server-side guards                                                                                                                                                                 |
| **Org reference on `/settings` (read-only lists)**                               | Done   | Locations, users, categories, units, departments; threshold edits ADMIN-only                                                                                                                                                        |
| **Global search (CmdK)**                                                         | Done   | Module hits respect **feature flags**. **STAFF** has no employee hits; **VIEWER** does when `employees` is on. Product rows open **movements** (`?product=`) for VIEWER (edit URL is blocked at the edge).                          |
| **Header notifications (+ `/me` if Viewer uses portal)**                         | Done   | Shared UX; unread counts wherever role can access `/me`                                                                                                                                                                             |
| **Curated “my watchlist” / pinned entities on dashboard**                        | Done   | `User.dashboardPins` JSON; **VIEWER** bookmark column on Inventory & Projects; **My watchlist** card on `/dashboard`. Caps: 10 products / 10 projects; respects **projects** feature flag.                                          |
| **Explain stock / links to last movement summaries on product**                  | Done   | Read-only **`/inventory/[id]`**: ledger explainer, stock-by-location, latest movements + deep link to **`/inventory/movements?product=`**; product names link from catalog                                                          |
| **Read-only trend cards (movement velocity, backlog age)**                       | Done   | Dashboard: **Movement volume** chart (sum of IN vs OUT quantities, same period picker as activity chart); **Receive backlog age** bar chart (ORDERED / PARTIALLY_RECEIVED POs by SLA tier vs last update). Charts only — no export. |

---

## Blocked mutations (parity with code)

| Item                                                                        | Status | Notes                                                                                                                         |
| --------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Edge block: inventory receive/new/edit paths**                            | Done   | `viewerBlockedWritePathname`                                                                                                  |
| **Edge block: `purchase-orders/new`, `projects/new`, customer create/edit** | Done   | Same helper                                                                                                                   |
| **Cannot record stock movements (server)**                                  | Done   | `canRecordStockMovement` excludes VIEWER                                                                                      |
| **Restrict `/manager` for VIEWER (optional)**                               | Done   | `canAccessManagerHub`: ADMIN/MANAGER only; edge `viewerBlockedManagerHubPathname`; sidebar + dashboard link hidden for VIEWER |

---

## Exports & compliance

| Item                                         | Status | Notes                                                                                                                                                                                                                     |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employees directory CSV**                  | Done   | VIEWER allowed per `canExportEmployeesDirectoryCsv`                                                                                                                                                                       |
| **Financial CSVs blocked**                   | Done   | VIEWER forbidden for `canExportFinancialCsv`                                                                                                                                                                              |
| **Attendance team CSV blocked**              | Done   | VIEWER forbidden for `canExportAttendanceCsv`                                                                                                                                                                             |
| **Export audit trail (who downloaded what)** | Done   | **`/me/my-exports`** — paginated **EXPORT** `AuditEvent` rows for the signed-in user only; linked from **My portal**. Server CSV exports only (matches admin audit log); client-built CSVs noted as out of scope on page. |

---

## How to use this doc

Same as [`staff-portal-roadmap.md`](./staff-portal-roadmap.md).
