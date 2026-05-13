# Database performance — Aqila IMS

Operational notes for **PostgreSQL query health**: what the repo indexes for, how operators monitor slow queries, and where to look before adding caching layers.

**Related:** [`production-readiness.md`](./production-readiness.md) tracker **16**, [`database-connection-pooling.md`](./database-connection-pooling.md), [`database-backups-and-restore.md`](./database-backups-and-restore.md), [`application-observability.md`](./application-observability.md), [`prisma/schema.prisma`](../prisma/schema.prisma), migration **`20260514100000_performance_indexes`**.

---

## 1. Indexes maintained in-repo

Prisma **`@@index`** definitions (and matching migrations) target **high-frequency filters and sorts**. PostgreSQL may still choose sequential scans on small tables — that is normal in development.

| Area          | Models / indexes                                                               | Typical callers                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock ledger  | `StockMovement`: `createdAt` DESC; `(stockId, createdAt)`; `(type, createdAt)` | Movements list/export ([`stock-movements.ts`](../src/lib/queries/stock-movements.ts)), dashboard “recent movements”, product overview, weekly IN/OUT counts ([`manager-overview.ts`](../src/lib/queries/manager-overview.ts)), digest-adjacent aggregates ([`daily-digest.ts`](../src/lib/notifications/daily-digest.ts)) |
| Branch stock  | `Stock.locationId`                                                             | Low-stock raw SQL in layout / Me portal (`WHERE locationId = …`)                                                                                                                                                                                                                                                          |
| Procurement   | `PurchaseOrder`: `createdAt` DESC; `(status, createdAt)`                       | PO list ([`purchase-orders/page.tsx`](<../src/app/(dashboard)/purchase-orders/page.tsx>)), dashboard counters, manager overview                                                                                                                                                                                           |
| Projects      | `Project`: same pattern                                                        | Projects list ([`projects/page.tsx`](<../src/app/(dashboard)/projects/page.tsx>)), dashboards                                                                                                                                                                                                                             |
| HR log        | `Attendance.date` DESC                                                         | Attendance log ([`attendance-log.ts`](../src/lib/queries/attendance-log.ts)) — complements `(employeeId, date)` uniqueness                                                                                                                                                                                                |
| Shifts        | `(employeeId, startTime)`                                                      | Me portal upcoming shifts ([`me/page.tsx`](<../src/app/(dashboard)/me/page.tsx>))                                                                                                                                                                                                                                         |
| Notifications | `(userId, createdAt)` DESC; `(userId, isRead)`                                 | Dashboard layout unread badge + bell preview ([`layout.tsx`](<../src/app/(dashboard)/layout.tsx>), [`notifications/recent/route.ts`](../src/app/api/notifications/recent/route.ts), [`me/page.tsx`](<../src/app/(dashboard)/me/page.tsx>))                                                                                |

**Already indexed elsewhere:** `AuditEvent`, `PurchaseOrderAuditLog`, invite/OTP `emailNorm`, etc. — see `schema.prisma`.

---

## 2. Operator playbook — find slow queries

1. **Hosted Postgres** — enable **slow query logging** or **Query Insights** (vendor name varies: RDS Performance Insights, Neon monitoring, Supabase reports, etc.).
2. **`pg_stat_statements`** — identify top **total time** and **mean time** statements; reset stats after deploys when comparing fairly.
3. **Correlation** — tie spikes to **`x-request-id`** ([`logging-and-correlation.md`](./logging-and-correlation.md)) and route names when testing from the app tier.

Do **not** run destructive **`EXPLAIN ANALYZE`** on production write-heavy statements during peak without approval — prefer **staging** or **read replicas**.

---

## 3. Before adding Prisma / app caching

- Fix **N+1** and missing indexes first (cheaper than Redis).
- Prefer **`select` / `include` discipline** — avoid dragging large JSON blobs by default.
- **Next.js `unstable_cache` / `fetch` cache** — only after measuring TTFB on authenticated dashboard routes; IMS pages are often **role-specific** and **dynamic** (`force-dynamic` on dashboard shell).

---

## 4. Schema changes workflow

New indexes ship via **`prisma/migrations/`** (`AGENTS.md`). After deploy, **`REINDEX`** is rarely needed; verify **`EXPLAIN (ANALYZE, BUFFERS)`** on staging for the statements you tuned.

---

## 5. Tracker **16** honesty checklist

- [x] Inventory of hot paths + in-repo indexes documented (this file + `schema.prisma`).
- [ ] **Operator-only:** slow-query log / `pg_stat_statements` sampled on production-like volume.
- [ ] **Operator-only:** baseline captured (p95 API / page) before micro-optimisations.
