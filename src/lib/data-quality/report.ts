/**
 * Data-quality aggregates for `/settings/data-quality`.
 *
 * Follows common internal governance practice: DAMA-style dimensions, explicit rule codes,
 * severity tiers, snapshot timestamp + methodology version, deterministic match keys only
 * (no probabilistic matching — avoids false confidence).
 */

import { prisma } from "@/lib/db";

/** DAMA / DQ practitioner shorthand — single-select per rule for reporting. */
export type DqDimension = "UNIQUENESS" | "CONSISTENCY" | "COMPLETENESS" | "VALIDITY";

/** ISO-style severity for triage (not alert paging). */
export type DqSeverity = "error" | "warning" | "informational";

export type CustomerDupCluster = {
  reason: "name" | "phone";
  key: string;
  /** Stricter triage when any candidate row is still active in CRM. */
  severity: DqSeverity;
  rows: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    isActive: boolean;
  }[];
};

export type DataQualityScorecardRow = {
  ruleCode: string;
  ruleName: string;
  dimension: DqDimension;
  severity: DqSeverity;
  /** Pass = control satisfied (zero actionable findings under this rule). */
  state: "pass" | "fail";
  /** Single-line metric for audit screenshots. */
  narrative: string;
};

export type DataQualityReport = {
  /** RFC3339 — interpret all counts as “as-of” this instant (no warehouse lag). */
  generatedAt: string;
  /** Bump when match keys or rule definitions change. */
  methodologyVersion: string;
  scorecard: DataQualityScorecardRow[];
  duplicateCustomersByName: CustomerDupCluster[];
  duplicateCustomersByPhone: CustomerDupCluster[];
  activeEmployeesInactiveUsers: {
    id: string;
    employeeCode: string;
    displayName: string;
    userEmail: string;
  }[];
  activeProductsInactiveSupplier: {
    id: string;
    sku: string;
    name: string;
    supplierId: string;
    supplierName: string;
  }[];
  projectsUnlinkedButNameMatchesCustomer: {
    projectId: string;
    projectCode: string;
    projectName: string;
    clientName: string;
    customerId: string;
    customerName: string;
  }[];
  stockMovementsWithoutUser: {
    total: number;
    recent: {
      id: string;
      createdAt: string;
      type: string;
      quantity: string;
      productSku: string;
    }[];
  };
  purchaseOrdersCreatedByInactiveUser: {
    id: string;
    poNumber: string;
    creatorEmail: string | null;
  }[];
};

export const DQ_METHODOLOGY_VERSION = "dq-console-v1";

export function normalizeCustomerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** E.164-style normalization not applied — digits only; minimum length reduces junk collisions. */
export function normalizePhoneDigits(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = phone.replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

function clusterSeverityForDup(rows: { isActive: boolean }[]): DqSeverity {
  return rows.some((r) => r.isActive) ? "warning" : "informational";
}

/** Rows beyond one “survivor” per duplicate key — standard remediation sizing hint. */
export function excessDuplicateRows(clusters: CustomerDupCluster[]): number {
  return clusters.reduce((acc, c) => acc + Math.max(0, c.rows.length - 1), 0);
}

function clusterByKey<
  T extends {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    isActive: boolean;
  },
>(rows: T[], reason: "name" | "phone", keyFn: (row: T) => string | null): CustomerDupCluster[] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      reason,
      key,
      severity: clusterSeverityForDup(list),
      rows: list.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        isActive: r.isActive,
      })),
    }))
    .sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key));
}

function worstSeverity(severities: DqSeverity[]): DqSeverity | null {
  if (severities.length === 0) return null;
  if (severities.includes("error")) return "error";
  if (severities.includes("warning")) return "warning";
  return "informational";
}

function buildScorecard(
  report: Omit<DataQualityReport, "generatedAt" | "methodologyVersion" | "scorecard">
): DataQualityScorecardRow[] {
  const nameDup = report.duplicateCustomersByName;
  const phoneDup = report.duplicateCustomersByPhone;
  const nameExcess = excessDuplicateRows(nameDup);
  const phoneExcess = excessDuplicateRows(phoneDup);

  const dupNameRuleSeverity = worstSeverity(nameDup.map((c) => c.severity)) ?? "informational";
  const dupPhoneRuleSeverity = worstSeverity(phoneDup.map((c) => c.severity)) ?? "informational";

  const rows: DataQualityScorecardRow[] = [
    {
      ruleCode: "CUST-UNI-NAME",
      ruleName: "Customer master — duplicate legal clusters (normalized name)",
      dimension: "UNIQUENESS",
      severity: dupNameRuleSeverity,
      state: nameDup.length === 0 ? "pass" : "fail",
      narrative:
        nameDup.length === 0
          ? "No duplicate-name clusters."
          : `${nameDup.length} cluster(s) · ${nameExcess} redundant row(s) after survivorship (review merge / deactivate).`,
    },
    {
      ruleCode: "CUST-UNI-PHONE",
      ruleName: "Customer master — duplicate clusters (normalized phone digits)",
      dimension: "UNIQUENESS",
      severity: dupPhoneRuleSeverity,
      state: phoneDup.length === 0 ? "pass" : "fail",
      narrative:
        phoneDup.length === 0
          ? "No duplicate-phone clusters (≥8 digits)."
          : `${phoneDup.length} cluster(s) · ${phoneExcess} redundant row(s) — especially review where names differ.`,
    },
    {
      ruleCode: "PRJ-LNK-CUST",
      ruleName: "Projects — free-text client aligns to master customer but FK unset",
      dimension: "CONSISTENCY",
      severity: "warning",
      state: report.projectsUnlinkedButNameMatchesCustomer.length === 0 ? "pass" : "fail",
      narrative:
        report.projectsUnlinkedButNameMatchesCustomer.length === 0
          ? "No orphaned textual clients matching master records."
          : `${report.projectsUnlinkedButNameMatchesCustomer.length} project(s) — set Customer link or correct spelling.`,
    },
    {
      ruleCode: "EMP-USR-ALIGN",
      ruleName: "Identity — active employee row with deactivated login",
      dimension: "CONSISTENCY",
      severity: "error",
      state: report.activeEmployeesInactiveUsers.length === 0 ? "pass" : "fail",
      narrative:
        report.activeEmployeesInactiveUsers.length === 0
          ? "No active/inactive mismatches."
          : `${report.activeEmployeesInactiveUsers.length} employee(s) — reconcile HR vs IAM.`,
    },
    {
      ruleCode: "PRD-SUP-ALIGN",
      ruleName: "Catalog — active SKU referencing inactive supplier",
      dimension: "CONSISTENCY",
      severity: "warning",
      state: report.activeProductsInactiveSupplier.length === 0 ? "pass" : "fail",
      narrative:
        report.activeProductsInactiveSupplier.length === 0
          ? "No active products on inactive vendors."
          : `${report.activeProductsInactiveSupplier.length} SKU(s) — change supplier or reactivate vendor.`,
    },
    {
      ruleCode: "MOV-USR-COMPLETE",
      ruleName: "Stock movements — missing performer (`userId` null)",
      dimension: "COMPLETENESS",
      severity: "warning",
      state: report.stockMovementsWithoutUser.total === 0 ? "pass" : "fail",
      narrative:
        report.stockMovementsWithoutUser.total === 0
          ? "No anonymous movements in ledger."
          : `${report.stockMovementsWithoutUser.total} movement row(s) — immutable legacy; ensure new posts always stamp actor.`,
    },
    {
      ruleCode: "PO-USR-HISTORY",
      ruleName: "Procurement — PO authored by since-disabled account",
      dimension: "VALIDITY",
      severity: "informational",
      state: report.purchaseOrdersCreatedByInactiveUser.length === 0 ? "pass" : "fail",
      narrative:
        report.purchaseOrdersCreatedByInactiveUser.length === 0
          ? "No historical POs from inactive creators in sample window."
          : `${report.purchaseOrdersCreatedByInactiveUser.length} PO row(s) shown — typically acceptable; governance visibility only.`,
    },
  ];

  return rows;
}

export async function getDataQualityReport(): Promise<DataQualityReport> {
  const generatedAt = new Date().toISOString();

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      isActive: true,
    },
  });

  const duplicateCustomersByName = clusterByKey(customers, "name", (c) =>
    normalizeCustomerName(c.name)
  );

  const duplicateCustomersByPhone = clusterByKey(customers, "phone", (c) =>
    normalizePhoneDigits(c.phone)
  );

  const activeEmployeesInactiveUsers = await prisma.employee.findMany({
    where: { isActive: true, user: { isActive: false } },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      user: { select: { email: true } },
    },
    orderBy: { employeeCode: "asc" },
  });

  const activeProductsInactiveSupplier = await prisma.product.findMany({
    where: {
      isActive: true,
      supplierId: { not: null },
      supplier: { isActive: false },
    },
    select: {
      id: true,
      sku: true,
      name: true,
      supplierId: true,
      supplier: { select: { name: true } },
    },
    orderBy: { sku: "asc" },
  });

  const customerLookup = new Map(
    customers.map((c) => [normalizeCustomerName(c.name), { id: c.id, name: c.name }] as const)
  );

  const unlinkedProjects = await prisma.project.findMany({
    where: {
      customerId: null,
      clientName: { not: null },
      NOT: { clientName: "" },
    },
    select: {
      id: true,
      projectCode: true,
      name: true,
      clientName: true,
    },
    orderBy: { projectCode: "desc" },
    take: 200,
  });

  const projectsUnlinkedButNameMatchesCustomer: DataQualityReport["projectsUnlinkedButNameMatchesCustomer"] =
    [];
  for (const p of unlinkedProjects) {
    const clientNorm = normalizeCustomerName(p.clientName!);
    const hit = customerLookup.get(clientNorm);
    if (hit) {
      projectsUnlinkedButNameMatchesCustomer.push({
        projectId: p.id,
        projectCode: p.projectCode,
        projectName: p.name,
        clientName: p.clientName!,
        customerId: hit.id,
        customerName: hit.name,
      });
    }
  }

  const anonymousTotal = await prisma.stockMovement.count({ where: { userId: null } });
  const anonymousRecentRaw = await prisma.stockMovement.findMany({
    where: { userId: null },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      createdAt: true,
      type: true,
      quantity: true,
      stock: { select: { product: { select: { sku: true } } } },
    },
  });

  const purchaseOrdersCreatedByInactiveUser = await prisma.purchaseOrder.findMany({
    where: { createdBy: { isActive: false } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      poNumber: true,
      createdBy: { select: { email: true } },
    },
  });

  const core = {
    duplicateCustomersByName,
    duplicateCustomersByPhone,
    activeEmployeesInactiveUsers: activeEmployeesInactiveUsers.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      displayName: `${e.firstName} ${e.lastName}`.trim(),
      userEmail: e.user.email,
    })),
    activeProductsInactiveSupplier: activeProductsInactiveSupplier.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      supplierId: p.supplierId!,
      supplierName: p.supplier?.name ?? "(unknown)",
    })),
    projectsUnlinkedButNameMatchesCustomer,
    stockMovementsWithoutUser: {
      total: anonymousTotal,
      recent: anonymousRecentRaw.map((m) => ({
        id: m.id,
        createdAt: m.createdAt.toISOString(),
        type: m.type,
        quantity: String(m.quantity),
        productSku: m.stock.product.sku,
      })),
    },
    purchaseOrdersCreatedByInactiveUser: purchaseOrdersCreatedByInactiveUser.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      creatorEmail: po.createdBy.email,
    })),
  };

  return {
    generatedAt,
    methodologyVersion: DQ_METHODOLOGY_VERSION,
    scorecard: buildScorecard(core),
    ...core,
  };
}
