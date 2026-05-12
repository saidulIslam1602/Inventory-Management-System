/**
 * Role-based access helpers — single place for permission rules.
 * No Prisma/Next imports: safe from API routes and the Edge proxy.
 */

export type AppRole = "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";

/** Warehouse / field ops: movements, goods-in, PO submit, etc. */
export function isOpsRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

/** Catalog, employees, customers, PO creation, approvals. */
export function isManagementRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function canAccessManagerHub(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "VIEWER";
}

export function canAccessEmployeesDirectory(role: string | undefined): boolean {
  return role != null && role !== "STAFF";
}

export function canAccessReportsAnalytics(role: string | undefined): boolean {
  return role != null && role !== "STAFF";
}

export function canAccessAdminSettings(role: string | undefined): boolean {
  return role === "ADMIN";
}

/** True if this pathname is blocked for STAFF at the edge (pages still enforce server-side). */
export function staffBlockedPathname(pathname: string): boolean {
  return (
    pathname.startsWith("/employees") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/manager")
  );
}

/**
 * Exports that include costs, PO totals, or project material values.
 * VIEWER is read-only in UI but must not bulk-download financial spreadsheets.
 */
export function canExportFinancialCsv(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

/**
 * Org-wide attendance export (or manager filters). STAFF uses a separate self-only flow.
 * VIEWER must not download team attendance CSVs.
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
