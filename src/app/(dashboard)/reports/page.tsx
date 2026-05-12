/**
 * Reports & Analytics page.
 * Server-rendered charts and exportable summaries.
 */

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { ReportsCharts } from "@/components/reports/reports-charts";
import { prismaDateForOsloCalendarDay } from "@/lib/business-calendar";
import type { ChartPeriodMode } from "@/lib/chart-period";
import {
  formatChartPeriodRangeDetail,
  formatChartPeriodTitle,
  osloPeriodUtcBounds,
  osloPeriodYmdRange,
  parseChartPeriod,
} from "@/lib/chart-period";
import { ChartPeriodToolbar } from "@/components/shared/chart-period-toolbar";

export const metadata: Metadata = { title: "Reports" };

async function getReportData(mode: ChartPeriodMode, offset: number) {
  const { start, end } = osloPeriodUtcBounds(mode, offset);
  const { startYmd, endYmd } = osloPeriodYmdRange(mode, offset);
  const attendanceFrom = prismaDateForOsloCalendarDay(startYmd);
  const attendanceTo = prismaDateForOsloCalendarDay(endYmd);

  const [
    movementsByType,
    topConsumedProducts,
    poSpendBySupplier,
    attendanceSummary,
    stockValueByCategory,
    incomingGoodsRaw,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
      SELECT type, COUNT(*) as count
      FROM stock_movements
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY type
      ORDER BY count DESC
    `,

    prisma.$queryRaw<Array<{ productName: string; totalOut: number }>>`
      SELECT p.name as "productName", COALESCE(SUM(sm.quantity), 0) as "totalOut"
      FROM stock_movements sm
      JOIN stock s ON sm."stockId" = s.id
      JOIN products p ON s."productId" = p.id
      WHERE sm.type = 'OUT'
        AND (sm."createdAt" AT TIME ZONE 'Europe/Oslo')::date >= (${attendanceFrom})::date
        AND (sm."createdAt" AT TIME ZONE 'Europe/Oslo')::date <= (${attendanceTo})::date
      GROUP BY p.name
      ORDER BY "totalOut" DESC
      LIMIT 10
    `,

    prisma.$queryRaw<Array<{ supplierName: string; totalSpend: number }>>`
      SELECT s.name as "supplierName", COALESCE(SUM(po."totalAmount"), 0) as "totalSpend"
      FROM purchase_orders po
      JOIN suppliers s ON po."supplierId" = s.id
      WHERE po.status = 'RECEIVED'
        AND COALESCE(po."receivedAt", po."updatedAt") >= ${start}
        AND COALESCE(po."receivedAt", po."updatedAt") <= ${end}
      GROUP BY s.name
      ORDER BY "totalSpend" DESC
      LIMIT 8
    `,

    prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) as count
      FROM attendance
      WHERE date >= ${attendanceFrom}::date AND date <= ${attendanceTo}::date
      GROUP BY status
    `,

    prisma.$queryRaw<Array<{ categoryName: string; totalValue: number }>>`
      SELECT c.name as "categoryName",
             COALESCE(SUM(s.quantity * p."unitPrice"), 0) as "totalValue"
      FROM stock s
      JOIN products p ON s."productId" = p.id
      JOIN categories c ON p."categoryId" = c.id
      GROUP BY c.name
      ORDER BY "totalValue" DESC
    `,

    prisma.$queryRaw<
      Array<{ valueNok: number; qtyIn: number; linesWithCost: bigint; linesNoCost: bigint }>
    >`
      SELECT
        COALESCE(SUM(CASE WHEN sm."unitCost" IS NOT NULL THEN sm.quantity * sm."unitCost" ELSE 0 END), 0)::double precision AS "valueNok",
        COALESCE(SUM(sm.quantity), 0)::double precision AS "qtyIn",
        COUNT(*) FILTER (WHERE sm."unitCost" IS NOT NULL)::bigint AS "linesWithCost",
        COUNT(*) FILTER (WHERE sm."unitCost" IS NULL)::bigint AS "linesNoCost"
      FROM stock_movements sm
      WHERE sm.type = 'IN'
        AND sm."createdAt" >= ${start} AND sm."createdAt" <= ${end}
    `,
  ]);

  const ig = incomingGoodsRaw[0];
  const incomingGoods = {
    valueNok: ig ? Number(ig.valueNok) : 0,
    quantityIn: ig ? Number(ig.qtyIn) : 0,
    linesWithCost: ig ? Number(ig.linesWithCost) : 0,
    linesNoCost: ig ? Number(ig.linesNoCost) : 0,
  };

  return {
    movementsByType: movementsByType.map((r) => ({ type: r.type, count: Number(r.count) })),
    topConsumedProducts: topConsumedProducts.map((r) => ({
      name: r.productName,
      value: Number(r.totalOut),
    })),
    poSpendBySupplier: poSpendBySupplier.map((r) => ({
      name: r.supplierName,
      value: Number(r.totalSpend),
    })),
    attendanceSummary: attendanceSummary.map((r) => ({
      status: r.status,
      count: Number(r.count),
    })),
    stockValueByCategory: stockValueByCategory.map((r) => ({
      name: r.categoryName,
      value: Number(r.totalValue),
    })),
    incomingGoods,
    chartPeriod: {
      mode,
      offset,
      title: formatChartPeriodTitle(mode, offset),
      detail: formatChartPeriodRangeDetail(mode, offset),
      startYmd,
      endYmd,
    },
  };
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user?.role === "STAFF") {
    redirect("/me");
  }

  const sp = await searchParams;
  const { mode, offset } = parseChartPeriod(sp);
  const data = await getReportData(mode, offset);
  const { chartPeriod } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description={`${chartPeriod.title} · ${chartPeriod.detail}`}
        actions={
          <ChartPeriodToolbar
            pathname="/reports"
            mode={chartPeriod.mode}
            offset={chartPeriod.offset}
          />
        }
      />

      <ReportsCharts data={data} />
    </div>
  );
}
