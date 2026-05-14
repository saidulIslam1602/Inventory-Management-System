/**
 * Manager hub — cross-location scorecards, exceptions, procurement queues,
 * transfer hints, attendance snapshot, project portfolio, digest inputs.
 */

import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/app-settings";
import { todayOsloPrismaDate } from "@/lib/business-calendar";
import { differenceInCalendarDays, subDays } from "date-fns";

import { formatQuantityNbNo } from "@/lib/utils";
import {
  pendingApprovalAgingTier,
  receivingPipelineAgingTier,
  type ManagerPendingAgingTier,
} from "@/lib/manager-aging";

export type LocationScorecard = {
  id: string;
  name: string;
  type: string;
  lowStockSkus: number;
  openPoCount: number;
  receivingPipelineCount: number;
  activeProjects: number;
  presentToday: number;
  activeEmployees: number;
};

export type ExceptionItem = {
  id: string;
  severity: "high" | "medium";
  category: string;
  title: string;
  detail: string;
  href: string;
};

export type TransferSuggestion = {
  productId: string;
  sku: string;
  productName: string;
  unitSymbol: string;
  fromStockId: string;
  fromLocationId: string;
  fromLocationName: string;
  fromQty: number;
  availableUnreserved: number;
  suggestedQty: number;
  toLocationId: string;
  toLocationName: string;
  toQty: number;
  reorderPoint: number;
};

export type ReceiveBacklogRow = {
  id: string;
  poNumber: string;
  status: string;
  supplierName: string;
  locationName: string;
  locationId: string;
  expectedDate: Date | null;
  updatedAt: Date;
  daysSinceOrder: number;
};

export type PendingApprovalPO = {
  id: string;
  poNumber: string;
  supplierName: string;
  locationName: string;
  locationId: string;
  totalAmount: number;
  createdAt: Date;
  daysWaiting: number;
};

/** Unified “needs you” rows for `/manager` decision inbox. */
export type ManagerDecisionQueueKind =
  | "exception"
  | "po_approve"
  | "receive_backlog"
  | "transfer_suggested";

export type ManagerDecisionQueueItem = {
  id: string;
  kind: ManagerDecisionQueueKind;
  /** Higher = surfaced earlier */
  sortScore: number;
  badge: string;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
  accent?: "destructive" | "warning";
  /** Present for `po_approve` and `receive_backlog` — UI aging strip + badge */
  slaTier?: ManagerPendingAgingTier;
};

export type AttendanceByLocation = {
  locationId: string;
  locationName: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  other: number;
  noRow: number;
  totalEmployees: number;
};

export type ProjectPortfolioRow = {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  clientName: string | null;
  locationName: string;
};

export type ReorderAggRow = {
  productId: string;
  sku: string;
  name: string;
  unitSymbol: string;
  lowLocationCount: number;
  totalQty: number;
};

export type MaterialRiskRow = {
  projectId: string;
  projectCode: string;
  name: string;
  locationName: string;
  sku: string;
  productName: string;
  reserved: number;
  onHand: number;
};

/** Active branches for `/manager` team filter & validation. */
export async function getManagerBranchOptions() {
  return prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getLocationScorecards(
  branchLocationId?: string
): Promise<LocationScorecard[]> {
  const today = todayOsloPrismaDate();

  const locations = await prisma.location.findMany({
    where: { isActive: true, ...(branchLocationId ? { id: branchLocationId } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });

  const [lowStockByLoc, openPoByLoc, pipelineByLoc, projectsByLoc, presentByLoc, headcountByLoc] =
    await Promise.all([
      prisma.$queryRaw<Array<{ locationId: string; c: bigint }>>`
      SELECT s."locationId" as "locationId", COUNT(DISTINCT s."productId")::bigint as c
      FROM stock s
      WHERE s.quantity <= s."reorderPoint" AND s."reorderPoint" > 0
      GROUP BY s."locationId"
    `,
      prisma.purchaseOrder.groupBy({
        by: ["locationId"],
        where: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } },
        _count: { _all: true },
      }),
      prisma.purchaseOrder.groupBy({
        by: ["locationId"],
        where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
        _count: { _all: true },
      }),
      prisma.project.groupBy({
        by: ["locationId"],
        where: { status: "IN_PROGRESS" },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ locationId: string; c: bigint }>>`
      SELECT e."locationId" as "locationId", COUNT(*)::bigint as c
      FROM attendance a
      JOIN employees e ON e.id = a."employeeId"
      WHERE a.date = ${today} AND a.status = 'PRESENT'
      GROUP BY e."locationId"
    `,
      prisma.employee.groupBy({
        by: ["locationId"],
        where: { isActive: true },
        _count: { _all: true },
      }),
    ]);

  const lowMap = Object.fromEntries(lowStockByLoc.map((r) => [r.locationId, Number(r.c)]));
  const openMap = Object.fromEntries(openPoByLoc.map((r) => [r.locationId, r._count._all]));
  const pipeMap = Object.fromEntries(pipelineByLoc.map((r) => [r.locationId, r._count._all]));
  const projMap = Object.fromEntries(projectsByLoc.map((r) => [r.locationId, r._count._all]));
  const presMap = Object.fromEntries(presentByLoc.map((r) => [r.locationId, Number(r.c)]));
  const headMap = Object.fromEntries(headcountByLoc.map((r) => [r.locationId, r._count._all]));

  return locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    type: loc.type,
    lowStockSkus: lowMap[loc.id] ?? 0,
    openPoCount: openMap[loc.id] ?? 0,
    receivingPipelineCount: pipeMap[loc.id] ?? 0,
    activeProjects: projMap[loc.id] ?? 0,
    presentToday: presMap[loc.id] ?? 0,
    activeEmployees: headMap[loc.id] ?? 0,
  }));
}

export async function getTransferSuggestions(
  limit = 25,
  branchLocationId?: string
): Promise<TransferSuggestion[]> {
  const rows = branchLocationId
    ? await prisma.$queryRaw<
        Array<{
          productId: string;
          sku: string;
          productName: string;
          symbol: string;
          fromStockId: string;
          fromLocationId: string;
          fromName: string;
          fromQty: unknown;
          availableUnreserved: unknown;
          toLocationId: string;
          toName: string;
          toQty: unknown;
          reorderPoint: unknown;
        }>
      >`
    SELECT
      p.id as "productId",
      p.sku,
      p.name as "productName",
      u.symbol,
      s_from.id as "fromStockId",
      s_from."locationId" as "fromLocationId",
      l_from.name as "fromName",
      s_from.quantity as "fromQty",
      (s_from.quantity - s_from.reserved) as "availableUnreserved",
      s_to."locationId" as "toLocationId",
      l_to.name as "toName",
      s_to.quantity as "toQty",
      s_to."reorderPoint" as "reorderPoint"
    FROM stock s_from
    JOIN stock s_to ON s_to."productId" = s_from."productId" AND s_to."locationId" != s_from."locationId"
    JOIN products p ON p.id = s_from."productId"
    JOIN units u ON u.id = p."unitId"
    JOIN locations l_from ON l_from.id = s_from."locationId"
    JOIN locations l_to ON l_to.id = s_to."locationId"
    WHERE s_to.quantity <= s_to."reorderPoint"
      AND s_to."reorderPoint" > 0
      AND s_from.quantity > s_from."reorderPoint" + (s_to."reorderPoint" * 0.5)
      AND (s_from.quantity - s_from.reserved) > 0
      AND l_from."isActive" = true AND l_to."isActive" = true AND p."isActive" = true
      AND (s_to."locationId" = ${branchLocationId} OR s_from."locationId" = ${branchLocationId})
    ORDER BY (s_to."reorderPoint" - s_to.quantity) DESC, s_from.quantity DESC
    LIMIT ${limit}
  `
    : await prisma.$queryRaw<
        Array<{
          productId: string;
          sku: string;
          productName: string;
          symbol: string;
          fromStockId: string;
          fromLocationId: string;
          fromName: string;
          fromQty: unknown;
          availableUnreserved: unknown;
          toLocationId: string;
          toName: string;
          toQty: unknown;
          reorderPoint: unknown;
        }>
      >`
    SELECT
      p.id as "productId",
      p.sku,
      p.name as "productName",
      u.symbol,
      s_from.id as "fromStockId",
      s_from."locationId" as "fromLocationId",
      l_from.name as "fromName",
      s_from.quantity as "fromQty",
      (s_from.quantity - s_from.reserved) as "availableUnreserved",
      s_to."locationId" as "toLocationId",
      l_to.name as "toName",
      s_to.quantity as "toQty",
      s_to."reorderPoint" as "reorderPoint"
    FROM stock s_from
    JOIN stock s_to ON s_to."productId" = s_from."productId" AND s_to."locationId" != s_from."locationId"
    JOIN products p ON p.id = s_from."productId"
    JOIN units u ON u.id = p."unitId"
    JOIN locations l_from ON l_from.id = s_from."locationId"
    JOIN locations l_to ON l_to.id = s_to."locationId"
    WHERE s_to.quantity <= s_to."reorderPoint"
      AND s_to."reorderPoint" > 0
      AND s_from.quantity > s_from."reorderPoint" + (s_to."reorderPoint" * 0.5)
      AND (s_from.quantity - s_from.reserved) > 0
      AND l_from."isActive" = true AND l_to."isActive" = true AND p."isActive" = true
    ORDER BY (s_to."reorderPoint" - s_to.quantity) DESC, s_from.quantity DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => {
    const reorderPoint = Number(r.reorderPoint);
    const toQty = Number(r.toQty);
    const avail = Math.max(0, Number(r.availableUnreserved));
    const shortfall = Math.max(0, reorderPoint - toQty);
    const suggestedQty =
      shortfall > 1e-9 ? Math.min(avail, shortfall) : Math.min(avail, Number(r.fromQty));
    return {
      productId: r.productId,
      sku: r.sku,
      productName: r.productName,
      unitSymbol: r.symbol,
      fromStockId: r.fromStockId,
      fromLocationId: r.fromLocationId,
      fromLocationName: r.fromName,
      fromQty: Number(r.fromQty),
      availableUnreserved: avail,
      suggestedQty: suggestedQty > 0 ? suggestedQty : avail,
      toLocationId: r.toLocationId,
      toLocationName: r.toName,
      toQty,
      reorderPoint,
    };
  });
}

export async function getPendingApprovalPOs(
  branchLocationId?: string
): Promise<PendingApprovalPO[]> {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      status: "SUBMITTED",
      ...(branchLocationId ? { locationId: branchLocationId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      supplier: { select: { name: true } },
      location: { select: { name: true } },
    },
  });
  const now = new Date();
  return pos.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    supplierName: po.supplier.name,
    locationName: po.location.name,
    locationId: po.locationId,
    totalAmount: Number(po.totalAmount),
    createdAt: po.createdAt,
    daysWaiting: Math.max(0, differenceInCalendarDays(now, po.createdAt)),
  }));
}

export async function getReceiveBacklog(branchLocationId?: string): Promise<ReceiveBacklogRow[]> {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] },
      ...(branchLocationId ? { locationId: branchLocationId } : {}),
    },
    orderBy: { updatedAt: "asc" },
    take: 40,
    include: {
      supplier: { select: { name: true } },
      location: { select: { name: true } },
    },
  });
  const now = new Date();
  return pos.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    supplierName: po.supplier.name,
    locationName: po.location.name,
    locationId: po.locationId,
    expectedDate: po.expectedDate,
    updatedAt: po.updatedAt,
    daysSinceOrder: differenceInCalendarDays(now, po.updatedAt),
  }));
}

export async function getAttendanceSnapshotByLocation(
  branchLocationId?: string
): Promise<AttendanceByLocation[]> {
  const today = todayOsloPrismaDate();
  const locations = await prisma.location.findMany({
    where: { isActive: true, ...(branchLocationId ? { id: branchLocationId } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, locationId: true },
  });
  const attendance = await prisma.attendance.findMany({
    where: { date: today },
    select: { employeeId: true, status: true },
  });
  const attByEmp = new Map(attendance.map((a) => [a.employeeId, a.status]));
  const empsByLoc = new Map<string, string[]>();
  for (const e of employees) {
    const list = empsByLoc.get(e.locationId) ?? [];
    list.push(e.id);
    empsByLoc.set(e.locationId, list);
  }

  return locations.map((loc) => {
    const ids = empsByLoc.get(loc.id) ?? [];
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    let other = 0;
    let noRow = 0;
    for (const eid of ids) {
      const st = attByEmp.get(eid);
      if (!st) {
        noRow++;
        continue;
      }
      if (st === "PRESENT") present++;
      else if (st === "ABSENT") absent++;
      else if (st === "LATE") late++;
      else if (st === "LEAVE") leave++;
      else other++;
    }
    return {
      locationId: loc.id,
      locationName: loc.name,
      present,
      absent,
      late,
      leave,
      other,
      noRow,
      totalEmployees: ids.length,
    };
  });
}

export async function getProjectPortfolio(branchLocationId?: string): Promise<{
  byStatus: Array<{ status: string; count: number }>;
  active: ProjectPortfolioRow[];
  onHold: ProjectPortfolioRow[];
}> {
  const locFilter = branchLocationId ? { locationId: branchLocationId } : {};
  const grouped = await prisma.project.groupBy({
    by: ["status"],
    where: locFilter,
    _count: { _all: true },
  });
  const byStatus = grouped.map((g) => ({ status: g.status, count: g._count._all }));

  const [active, onHold] = await Promise.all([
    prisma.project.findMany({
      where: { status: "IN_PROGRESS", ...locFilter },
      take: 15,
      orderBy: { updatedAt: "desc" },
      include: { location: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { status: "ON_HOLD", ...locFilter },
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: { location: { select: { name: true } } },
    }),
  ]);

  const mapRow = (p: (typeof active)[0]): ProjectPortfolioRow => ({
    id: p.id,
    projectCode: p.projectCode,
    name: p.name,
    status: p.status,
    clientName: p.clientName,
    locationName: p.location.name,
  });

  return {
    byStatus,
    active: active.map(mapRow),
    onHold: onHold.map(mapRow),
  };
}

export async function getAggregatedLowStockAlerts(limit = 20): Promise<ReorderAggRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      productId: string;
      sku: string;
      name: string;
      symbol: string;
      lowLocationCount: bigint;
      totalQty: unknown;
    }>
  >`
    SELECT
      p.id as "productId",
      p.sku,
      p.name,
      u.symbol,
      COUNT(*) FILTER (WHERE s.quantity <= s."reorderPoint" AND s."reorderPoint" > 0)::bigint as "lowLocationCount",
      SUM(s.quantity) as "totalQty"
    FROM stock s
    JOIN products p ON p.id = s."productId"
    JOIN units u ON u.id = p."unitId"
    WHERE p."isActive" = true
    GROUP BY p.id, p.sku, p.name, u.symbol
    HAVING COUNT(*) FILTER (WHERE s.quantity <= s."reorderPoint" AND s."reorderPoint" > 0) >= 2
    ORDER BY "lowLocationCount" DESC, SUM(s.quantity) ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    productId: r.productId,
    sku: r.sku,
    name: r.name,
    unitSymbol: r.symbol,
    lowLocationCount: Number(r.lowLocationCount),
    totalQty: Number(r.totalQty),
  }));
}

/** SKUs below reorder at a single branch — used when `/manager` is scoped to one location. */
export async function getLowStockSkusAtBranch(
  branchLocationId: string,
  limit = 15
): Promise<ReorderAggRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      productId: string;
      sku: string;
      name: string;
      symbol: string;
      totalQty: unknown;
    }>
  >`
    SELECT
      p.id as "productId",
      p.sku,
      p.name,
      u.symbol,
      s.quantity as "totalQty"
    FROM stock s
    JOIN products p ON p.id = s."productId"
    JOIN units u ON u.id = p."unitId"
    WHERE p."isActive" = true
      AND s."locationId" = ${branchLocationId}
      AND s.quantity <= s."reorderPoint"
      AND s."reorderPoint" > 0
    ORDER BY (s."reorderPoint" - s.quantity) DESC, s.quantity ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    productId: r.productId,
    sku: r.sku,
    name: r.name,
    unitSymbol: r.symbol,
    lowLocationCount: 1,
    totalQty: Number(r.totalQty),
  }));
}

export async function getProjectMaterialRisks(
  limit = 15,
  branchLocationId?: string
): Promise<MaterialRiskRow[]> {
  const rows = branchLocationId
    ? await prisma.$queryRaw<
        Array<{
          projectId: string;
          projectCode: string;
          name: string;
          locationName: string;
          sku: string;
          productName: string;
          reserved: unknown;
          onHand: unknown;
        }>
      >`
    SELECT
      p.id as "projectId",
      p."projectCode",
      p.name,
      l.name as "locationName",
      pr.sku,
      pr.name as "productName",
      pm."reservedQuantity" as reserved,
      s.quantity as "onHand"
    FROM projects p
    JOIN project_materials pm ON pm."projectId" = p.id
    JOIN products pr ON pr.id = pm."productId"
    JOIN stock s ON s."productId" = pr.id AND s."locationId" = p."locationId"
    JOIN locations l ON l.id = p."locationId"
    WHERE p.status = 'IN_PROGRESS'
      AND p."locationId" = ${branchLocationId}
      AND pm."reservedQuantity" > 0
      AND s.quantity < pm."reservedQuantity"
    ORDER BY (pm."reservedQuantity" - s.quantity) DESC
    LIMIT ${limit}
  `
    : await prisma.$queryRaw<
        Array<{
          projectId: string;
          projectCode: string;
          name: string;
          locationName: string;
          sku: string;
          productName: string;
          reserved: unknown;
          onHand: unknown;
        }>
      >`
    SELECT
      p.id as "projectId",
      p."projectCode",
      p.name,
      l.name as "locationName",
      pr.sku,
      pr.name as "productName",
      pm."reservedQuantity" as reserved,
      s.quantity as "onHand"
    FROM projects p
    JOIN project_materials pm ON pm."projectId" = p.id
    JOIN products pr ON pr.id = pm."productId"
    JOIN stock s ON s."productId" = pr.id AND s."locationId" = p."locationId"
    JOIN locations l ON l.id = p."locationId"
    WHERE p.status = 'IN_PROGRESS'
      AND pm."reservedQuantity" > 0
      AND s.quantity < pm."reservedQuantity"
    ORDER BY (pm."reservedQuantity" - s.quantity) DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    projectId: r.projectId,
    projectCode: r.projectCode,
    name: r.name,
    locationName: r.locationName,
    sku: r.sku,
    productName: r.productName,
    reserved: Number(r.reserved),
    onHand: Number(r.onHand),
  }));
}

export async function getManagerDigestStats() {
  const weekAgo = subDays(new Date(), 7);
  const [movementsIn, movementsOut, posSubmitted, projectsNew] = await Promise.all([
    prisma.stockMovement.count({ where: { type: "IN", createdAt: { gte: weekAgo } } }),
    prisma.stockMovement.count({ where: { type: "OUT", createdAt: { gte: weekAgo } } }),
    prisma.purchaseOrder.count({
      where: { createdAt: { gte: weekAgo }, status: { not: "DRAFT" } },
    }),
    prisma.project.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);
  return { movementsIn, movementsOut, posSubmitted, projectsNew, since: weekAgo };
}

export type BuildExceptionQueueOptions = {
  /** When set, only exceptions relevant to this branch (manager team filter). */
  locationId?: string;
};

export async function buildExceptionQueue(
  opts: BuildExceptionQueueOptions = {}
): Promise<ExceptionItem[]> {
  const { locationId } = opts;
  const settings = await getAppSettings();
  const items: ExceptionItem[] = [];
  const today = todayOsloPrismaDate();
  const now = new Date();
  const staleSubmitCutoff = subDays(now, settings.exceptionStaleSubmitDays);
  const lateReceiveCutoff = subDays(now, settings.exceptionOverdueReceiveDays);
  const minLowBranches = settings.exceptionMinLowStockBranches;

  const materialRisksFirst = await getProjectMaterialRisks(5, locationId);

  const [staleSubmitted, overdueReceive, lowStockLocs, onHoldProjects, lateToday] =
    await Promise.all([
      prisma.purchaseOrder.findMany({
        where: {
          status: "SUBMITTED",
          createdAt: { lt: staleSubmitCutoff },
          ...(locationId ? { locationId } : {}),
        },
        take: 20,
        orderBy: { createdAt: "asc" },
        select: { id: true, poNumber: true, createdAt: true },
      }),
      prisma.purchaseOrder.findMany({
        where: {
          status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] },
          OR: [
            { expectedDate: { lt: lateReceiveCutoff, not: null } },
            { expectedDate: null, updatedAt: { lt: lateReceiveCutoff } },
          ],
          ...(locationId ? { locationId } : {}),
        },
        take: 20,
        orderBy: { expectedDate: "asc" },
        select: { id: true, poNumber: true, expectedDate: true },
      }),
      locationId
        ? prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT s."locationId")::bigint as c FROM stock s
        WHERE s.quantity <= s."reorderPoint" AND s."reorderPoint" > 0
          AND s."locationId" = ${locationId}
      `
        : prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT s."locationId")::bigint as c FROM stock s
        WHERE s.quantity <= s."reorderPoint" AND s."reorderPoint" > 0
      `,
      prisma.project.count({
        where: {
          status: "ON_HOLD",
          ...(locationId ? { locationId } : {}),
        },
      }),
      prisma.attendance.count({
        where: {
          date: today,
          status: "LATE",
          ...(locationId ? { employee: { locationId } } : {}),
        },
      }),
    ]);

  const lowLocCount = Number(lowStockLocs[0]?.c ?? 0);

  for (const po of staleSubmitted) {
    items.push({
      id: `po-stale-${po.id}`,
      severity: "high",
      category: "Procurement",
      title: `PO ${po.poNumber} awaiting approval`,
      detail: `Submitted ${differenceInCalendarDays(now, po.createdAt)} days ago — review inbox.`,
      href: `/purchase-orders/${po.id}`,
    });
  }

  for (const po of overdueReceive) {
    items.push({
      id: `po-recv-${po.id}`,
      severity: "medium",
      category: "Receiving",
      title: `PO ${po.poNumber} may be overdue`,
      detail: po.expectedDate
        ? `Expected ${po.expectedDate.toLocaleDateString("nb-NO")}.`
        : "No expected date set; check supplier follow-up.",
      href: `/purchase-orders/${po.id}`,
    });
  }

  if (!locationId && lowLocCount >= minLowBranches) {
    items.push({
      id: "low-stock-multi",
      severity: "high",
      category: "Inventory",
      title: `Low stock in ${minLowBranches}+ branches`,
      detail: `${lowLocCount} locations have at least one SKU below reorder. Consider transfers or a purchase batch.`,
      href: "/inventory",
    });
  }

  if (onHoldProjects > 0) {
    items.push({
      id: "projects-hold",
      severity: "medium",
      category: "Projects",
      title: `${onHoldProjects} project(s) on hold`,
      detail: "Review blocked work and material reservations.",
      href: "/projects",
    });
  }

  if (lateToday > 0) {
    items.push({
      id: "attendance-late",
      severity: "medium",
      category: "People",
      title: `${lateToday} late arrival(s) today`,
      detail: "Oslo calendar day — follow up in attendance log.",
      href: "/employees/attendance",
    });
  }

  for (const r of materialRisksFirst) {
    items.push({
      id: `mat-${r.projectId}-${r.sku}`,
      severity: "high",
      category: "Projects",
      title: `Short stock for ${r.projectCode}`,
      detail: `${r.sku}: reserved ${r.reserved}, on hand ${r.onHand} at ${r.locationName}.`,
      href: `/projects/${r.projectId}`,
    });
  }

  items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  return items.slice(0, 40);
}

/**
 * Merges exception queue, PO approvals, receiving backlog, and transfer hints into one
 * prioritized list for the manager hub “decision inbox”.
 */
export function buildManagerDecisionQueue(input: {
  exceptions: ExceptionItem[];
  approvals: PendingApprovalPO[];
  receiveBacklog: ReceiveBacklogRow[];
  transfers: TransferSuggestion[];
  transferLimit?: number;
}): ManagerDecisionQueueItem[] {
  const staleApprovePoIds = new Set(
    input.exceptions
      .filter((e) => e.id.startsWith("po-stale-"))
      .map((e) => e.id.replace("po-stale-", ""))
  );
  const overdueRecvPoIds = new Set(
    input.exceptions
      .filter((e) => e.id.startsWith("po-recv-"))
      .map((e) => e.id.replace("po-recv-", ""))
  );

  const out: ManagerDecisionQueueItem[] = [];

  input.exceptions.forEach((ex, i) => {
    const base = ex.severity === "high" ? 1_000_000 : 880_000;
    out.push({
      id: `ex:${ex.id}`,
      kind: "exception",
      sortScore: base - i * 50,
      badge: ex.category,
      title: ex.title,
      subtitle: ex.detail,
      meta: ex.severity === "high" ? "High" : "Medium",
      href: ex.href,
      accent: ex.severity === "high" ? "destructive" : "warning",
    });
  });

  for (const po of input.approvals) {
    if (staleApprovePoIds.has(po.id)) continue;
    const score = 420_000 + Math.min(po.daysWaiting, 200) * 600;
    out.push({
      id: `approve:${po.id}`,
      kind: "po_approve",
      sortScore: score,
      badge: "Approve PO",
      title: po.poNumber,
      subtitle: `${po.supplierName} · ${po.locationName}`,
      meta: `${po.totalAmount.toLocaleString("nb-NO", { style: "currency", currency: "NOK", minimumFractionDigits: 2 })} · queued ${po.daysWaiting}d`,
      href: `/purchase-orders/${po.id}`,
      accent: po.daysWaiting >= 3 ? "warning" : undefined,
      slaTier: pendingApprovalAgingTier(po.daysWaiting),
    });
  }

  for (const po of input.receiveBacklog) {
    if (overdueRecvPoIds.has(po.id)) continue;
    const score = 260_000 + Math.min(po.daysSinceOrder, 180) * 700;
    out.push({
      id: `recv:${po.id}`,
      kind: "receive_backlog",
      sortScore: score,
      badge: "Receiving",
      title: po.poNumber,
      subtitle: `${po.supplierName} · ${po.locationName}`,
      meta: `${po.status.replace(/_/g, " ")} · ${po.daysSinceOrder}d since update`,
      href: `/purchase-orders/${po.id}`,
      accent: po.daysSinceOrder >= 7 ? "warning" : undefined,
      slaTier: receivingPipelineAgingTier(po.daysSinceOrder),
    });
  }

  const tLimit = input.transferLimit ?? 15;
  input.transfers.slice(0, tLimit).forEach((t, i) => {
    const shortfall = Math.max(0, t.reorderPoint - t.toQty);
    const score =
      120_000 - i * 25 + Math.min(t.suggestedQty, 999) * 40 + Math.min(shortfall, 999) * 15;
    out.push({
      id: `xfer:${t.fromStockId}-${t.toLocationId}-${t.productId}`,
      kind: "transfer_suggested",
      sortScore: score,
      badge: "Transfer",
      title: t.sku,
      subtitle: t.productName,
      meta: `${t.fromLocationName} → ${t.toLocationName} · suggest ${formatQuantityNbNo(t.suggestedQty, t.unitSymbol)}`,
      href: `/inventory/movements?product=${encodeURIComponent(t.productId)}`,
      accent: t.reorderPoint > 1e-9 && shortfall >= t.reorderPoint * 0.5 ? "warning" : undefined,
    });
  });

  out.sort((a, b) => b.sortScore - a.sortScore);
  return out;
}
