/**
 * Reports & Analytics page.
 * Server-rendered charts and exportable summaries.
 */

import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportsCharts } from "@/components/reports/reports-charts";
import { subDays, format, startOfMonth, endOfMonth } from "date-fns";

export const metadata: Metadata = { title: "Reports" };

async function getReportData() {
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [
    movementsByType,
    topConsumedProducts,
    poSpendBySupplier,
    attendanceSummary,
    stockValueByCategory,
  ] = await Promise.all([
    // Movement counts by type in last 30 days
    prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
      SELECT type, COUNT(*) as count
      FROM stock_movements
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY type
      ORDER BY count DESC
    `,

    // Top 10 most consumed products this month
    prisma.$queryRaw<Array<{ productName: string; totalOut: number }>>`
      SELECT p.name as "productName", COALESCE(SUM(sm.quantity), 0) as "totalOut"
      FROM stock_movements sm
      JOIN stock s ON sm."stockId" = s.id
      JOIN products p ON s."productId" = p.id
      WHERE sm.type = 'OUT'
        AND sm."createdAt" >= ${monthStart}
        AND sm."createdAt" <= ${monthEnd}
      GROUP BY p.name
      ORDER BY "totalOut" DESC
      LIMIT 10
    `,

    // PO spend by supplier (all time)
    prisma.$queryRaw<Array<{ supplierName: string; totalSpend: number }>>`
      SELECT s.name as "supplierName", COALESCE(SUM(po."totalAmount"), 0) as "totalSpend"
      FROM purchase_orders po
      JOIN suppliers s ON po."supplierId" = s.id
      WHERE po.status = 'RECEIVED'
      GROUP BY s.name
      ORDER BY "totalSpend" DESC
      LIMIT 8
    `,

    // Attendance summary for current month
    prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) as count
      FROM attendance
      WHERE date >= ${monthStart} AND date <= ${monthEnd}
      GROUP BY status
    `,

    // Stock value by category
    prisma.$queryRaw<Array<{ categoryName: string; totalValue: number }>>`
      SELECT c.name as "categoryName",
             COALESCE(SUM(s.quantity * p."unitPrice"), 0) as "totalValue"
      FROM stock s
      JOIN products p ON s."productId" = p.id
      JOIN categories c ON p."categoryId" = c.id
      GROUP BY c.name
      ORDER BY "totalValue" DESC
    `,
  ]);

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
    period: {
      from: format(monthStart, "d MMMM"),
      to: format(monthEnd, "d MMMM yyyy"),
    },
  };
}

export default async function ReportsPage() {
  const data = await getReportData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description={`Current month: ${data.period.from} – ${data.period.to}`}
      />

      <ReportsCharts data={data} />
    </div>
  );
}
