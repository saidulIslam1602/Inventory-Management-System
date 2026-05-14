import {
  canAccessAdminSettings,
  canAccessAuditLogPage,
  canAccessDataQualityPage,
  canAccessEmployeesDirectory,
  canAccessManagerHub,
  canAccessReportsAnalytics,
  canAccessSettingsPage,
  canExportAttendanceCsv,
  canExportEmployeesDirectoryCsv,
  canExportFinancialCsv,
  canRecordStockMovement,
  canViewCatalogPricing,
  canViewMovementLedgerFinancialColumns,
  isManagementRole,
  isOpsRole,
  staffBlockedPathname,
  viewerBlockedManagerHubPathname,
  viewerBlockedReportsPathname,
  viewerBlockedWritePathname,
} from "@/lib/rbac";

const ROLES = ["ADMIN", "MANAGER", "STAFF", "VIEWER"] as const;

describe("rbac — tier helpers", () => {
  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", true],
    ["VIEWER", false],
    [undefined, false],
    ["", false],
  ] as const)("isOpsRole(%j) → %s", (role, expected) => {
    expect(isOpsRole(role)).toBe(expected);
  });

  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", false],
    ["VIEWER", false],
    [undefined, false],
  ] as const)("isManagementRole(%j) → %s", (role, expected) => {
    expect(isManagementRole(role)).toBe(expected);
  });

  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", false],
    ["VIEWER", false],
  ] as const)("canAccessManagerHub(%j) → %s", (role, expected) => {
    expect(canAccessManagerHub(role)).toBe(expected);
  });

  test.each(ROLES)("canAccessEmployeesDirectory(%s) — blocks STAFF only", (role) => {
    expect(canAccessEmployeesDirectory(role)).toBe(role !== "STAFF");
  });

  test("canAccessEmployeesDirectory(undefined) is false", () => {
    expect(canAccessEmployeesDirectory(undefined)).toBe(false);
  });

  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", false],
    ["VIEWER", false],
  ] as const)("canAccessReportsAnalytics(%j) → %s", (role, expected) => {
    expect(canAccessReportsAnalytics(role)).toBe(expected);
  });

  test.each([
    ["ADMIN", true],
    ["MANAGER", false],
    ["STAFF", false],
    ["VIEWER", false],
  ] as const)("canAccessAdminSettings / audit / data-quality (%j)", (role, admin) => {
    expect(canAccessAdminSettings(role)).toBe(admin);
    expect(canAccessAuditLogPage(role)).toBe(admin);
    expect(canAccessDataQualityPage(role)).toBe(admin);
  });

  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", false],
    ["VIEWER", true],
  ] as const)("canAccessSettingsPage(%j) → %s", (role, expected) => {
    expect(canAccessSettingsPage(role)).toBe(expected);
  });
});

describe("rbac — exports & pricing", () => {
  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", false],
    ["VIEWER", false],
  ] as const)("canExportFinancialCsv(%j) → %s", (role, expected) => {
    expect(canExportFinancialCsv(role)).toBe(expected);
  });

  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", true],
    ["VIEWER", false],
  ] as const)("canViewCatalogPricing(%j) → %s", (role, expected) => {
    expect(canViewCatalogPricing(role)).toBe(expected);
  });

  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", true],
    ["VIEWER", false],
  ] as const)("canViewMovementLedgerFinancialColumns(%j) → %s", (role, expected) => {
    expect(canViewMovementLedgerFinancialColumns(role)).toBe(expected);
  });

  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", true],
    ["VIEWER", false],
  ] as const)("canExportAttendanceCsv(%j) → %s", (role, expected) => {
    expect(canExportAttendanceCsv(role)).toBe(expected);
  });

  test.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", false],
    ["VIEWER", true],
  ] as const)("canExportEmployeesDirectoryCsv(%j) → %s", (role, expected) => {
    expect(canExportEmployeesDirectoryCsv(role)).toBe(expected);
  });

  test.each(ROLES)("canRecordStockMovement matches isOpsRole", (role) => {
    expect(canRecordStockMovement(role)).toBe(isOpsRole(role));
  });
});

describe("rbac — pathname guards", () => {
  test("viewerBlockedManagerHubPathname", () => {
    expect(viewerBlockedManagerHubPathname("/manager")).toBe(true);
    expect(viewerBlockedManagerHubPathname("/manager/purchase-orders")).toBe(true);
    expect(viewerBlockedManagerHubPathname("/dashboard")).toBe(false);
  });

  test("viewerBlockedReportsPathname", () => {
    expect(viewerBlockedReportsPathname("/reports")).toBe(true);
    expect(viewerBlockedReportsPathname("/reports/export")).toBe(true);
    expect(viewerBlockedReportsPathname("/inventory")).toBe(false);
  });

  test("staffBlockedPathname", () => {
    expect(staffBlockedPathname("/employees")).toBe(true);
    expect(staffBlockedPathname("/employees/x")).toBe(true);
    expect(staffBlockedPathname("/reports")).toBe(true);
    expect(staffBlockedPathname("/manager")).toBe(true);
    expect(staffBlockedPathname("/me")).toBe(false);
  });

  test("viewerBlockedWritePathname — inventory / PO / projects / customers", () => {
    expect(viewerBlockedWritePathname("/inventory/receive")).toBe(true);
    expect(viewerBlockedWritePathname("/inventory/new")).toBe(true);
    expect(viewerBlockedWritePathname("/inventory/abc123/edit")).toBe(true);
    expect(viewerBlockedWritePathname("/inventory/abc123")).toBe(false);
    expect(viewerBlockedWritePathname("/purchase-orders/new")).toBe(true);
    expect(viewerBlockedWritePathname("/projects/new")).toBe(true);
    expect(viewerBlockedWritePathname("/customers/new")).toBe(true);
    expect(viewerBlockedWritePathname("/customers/cu_1/edit")).toBe(true);
    expect(viewerBlockedWritePathname("/customers/cu_1")).toBe(false);
  });
});
