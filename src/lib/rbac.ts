/**
 * Role-based access helpers — single place for permission rules.
 * No Prisma/Next imports: safe from API routes and the Edge proxy.
 *
 * ## Role intent (aligned with common IMS / ERP practice — Acumatica / Odoo / NetSuite style tiers)
 *
 * | Concern | ADMIN | MANAGER | STAFF | VIEWER |
 * | --- | --- | --- | --- | --- |
 * | Tenant setup, audit log, data-quality consoles | ✓ |  |  |  |
 * | Manager hub (/manager), approvals, transfers inbox | ✓ | ✓ |  |  |
 * | Financial analytics (/reports) | ✓ | ✓ |  |  |
 * | Bulk financial CSV (PO / movements / projects APIs) | ✓ | ✓ |  |  |
 * | On-screen catalog pricing (list prices, inventory CSV incl. price) | ✓ | ✓ | ✓ |  |
 * | Movement ledger cost columns (unit cost / line value) | ✓ | ✓ | ✓ |  |
 * | Record stock movements, receive goods, ops workflows | ✓ | ✓ | ✓ |  |
 * | Team/org directories (/employees list — STAFF blocked at edge) | ✓ | ✓ |  | ✓ |
 * | Attendance CSV API | ✓ | ✓ | ✓ (self-rows only — enforced in route) |  |
 * | Org reference /settings (non-admin tabs) | ✓ | ✓ |  | ✓ |
 * | Employees directory CSV | ✓ | ✓ |  | ✓ |
 *
 * **Principle:** least privilege — VIEWER is observer-only without pricing/spend surfaces;
 * STAFF is operational without spreadsheet-scale financial extraction (management handles audits/reports).
 *
 * Edge: `proxy.ts` forwards **`x-request-id`** for `/api/*`; each Route Handler must call `auth()` + these helpers.
 */

export type AppRole = "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";

/** Warehouse / field ops: movements, goods-in, PO submit, etc. */
export function isOpsRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

/** Catalog edits, employees CRUD, customers CRUD, PO lifecycle approvals — excludes VIEWER/STAFF for edits at route/action layer. */
export function isManagementRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** Approvals, transfers, exception queue — operational hub (not read-only VIEWER). */
export function canAccessManagerHub(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** VIEWER must not open the manager hub (even read-only); use dashboards and catalogs instead. */
export function viewerBlockedManagerHubPathname(pathname: string): boolean {
  return pathname.startsWith("/manager");
}

export function canAccessEmployeesDirectory(role: string | undefined): boolean {
  return role != null && role !== "STAFF";
}

/** Financial analytics — STAFF use My portal; VIEWER lacks wholesale finance/report CSV parity. */
export function canAccessReportsAnalytics(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/** VIEWER must not open `/reports` (charts + client CSVs bypass export RBAC). */
export function viewerBlockedReportsPathname(pathname: string): boolean {
  return pathname.startsWith("/reports");
}

export function canAccessAdminSettings(role: string | undefined): boolean {
  return role === "ADMIN";
}

/** Append-only org audit log at `/settings/audit-log`. */
export function canAccessAuditLogPage(role: string | undefined): boolean {
  return role === "ADMIN";
}

/** Data quality consoles — `/settings/data-quality`. */
export function canAccessDataQualityPage(role: string | undefined): boolean {
  return role === "ADMIN";
}

/** Org reference data at `/settings` (locations, users list, taxonomy). STAFF uses field flows only. */
export function canAccessSettingsPage(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "VIEWER";
}

/** True if this pathname is blocked for STAFF at the edge (pages still enforce server-side). */
export function staffBlockedPathname(pathname: string): boolean {
  return (
    pathname.startsWith("/employees") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/manager")
  );
}

/** Write/edit flows VIEWER cannot use (reads stay on list/detail pages). */
export function viewerBlockedWritePathname(pathname: string): boolean {
  if (pathname === "/inventory/receive" || pathname === "/inventory/new") {
    return true;
  }
  if (/^\/inventory\/[^/]+\/edit$/.test(pathname)) {
    return true;
  }
  if (
    pathname === "/purchase-orders/new" ||
    pathname === "/projects/new" ||
    pathname === "/customers/new" ||
    /^\/customers\/[^/]+\/edit$/.test(pathname)
  ) {
    return true;
  }
  return false;
}

/**
 * Server/API spreadsheets containing PO totals, movement costs, project monetary aggregates — audit / FP&A tier only.
 * STAFF may perform receipts but must not bulk-extract financial books (standard warehouse-operator posture).
 */
export function canExportFinancialCsv(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/**
 * Product catalog list pricing & overview list price — operators need reorder/receipt context; VIEWER does not.
 */
export function canViewCatalogPricing(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

/**
 * Movement log columns unit cost / line value — same tier as dock reconciliation for ops; VIEWER excluded.
 */
export function canViewMovementLedgerFinancialColumns(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

/**
 * Attendance CSV: ADMIN/MANAGER org-wide (filtered); STAFF row-scope enforced in export Route Handler.
 * VIEWER blocked — team roster dumps (`portal`/privacy posture).
 */
export function canExportAttendanceCsv(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

export function canRecordStockMovement(role: string | undefined): boolean {
  return isOpsRole(role);
}

/** Employee directory CSV — STAFF must not export org roster. */
export function canExportEmployeesDirectoryCsv(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "VIEWER";
}
