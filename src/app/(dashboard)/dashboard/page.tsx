/**
 * Dashboard page — entry point after login.
 * Renders KPI cards, low-stock alerts, recent movements, and a stock trend chart.
 * All data is fetched server-side for fast initial load.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Package,
  ShoppingCart,
  FolderKanban,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { StatsCard } from "@/components/shared/stats-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StockTrendChart } from "@/components/inventory/stock-trend-chart";
import { StockQuantityTrendChart } from "@/components/inventory/stock-quantity-trend-chart";
import {
  ReceiveBacklogAgeChart,
  type ReceiveBacklogAgeBuckets,
} from "@/components/dashboard/receive-backlog-age-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatQuantityNbNo } from "@/lib/utils";
import { BUSINESS_TIME_ZONE, todayOsloPrismaDate } from "@/lib/business-calendar";
import type { ChartPeriodMode } from "@/lib/chart-period";
import {
  formatChartPeriodRangeDetail,
  formatChartPeriodTitle,
  osloPeriodUtcBounds,
  parseChartPeriod,
} from "@/lib/chart-period";
import { receivingPipelineAgingTier } from "@/lib/manager-aging";
import { canAccessManagerHub } from "@/lib/rbac";
import { movementQuantityDisplayPrefix } from "@/lib/stock-movement-display";
import { ChartPeriodToolbar } from "@/components/shared/chart-period-toolbar";
import { Button } from "@/components/ui/button";
import { ViewerWatchlistSection } from "@/components/dashboard/viewer-watchlist-section";

export const metadata: Metadata = { title: "Dashboard" };

async function getMovementTrendData(mode: ChartPeriodMode, offset: number) {
  const { start, end } = osloPeriodUtcBounds(mode, offset);

  if (mode === "year") {
    const monthlyMovements = await prisma.$queryRaw<
      Array<{ date: Date; in_count: bigint; out_count: bigint }>
    >`
      SELECT
        (date_trunc('month', ("createdAt" AT TIME ZONE 'Europe/Oslo')))::date as date,
        COUNT(*) FILTER (WHERE type = 'IN') as in_count,
        COUNT(*) FILTER (WHERE type = 'OUT') as out_count
      FROM stock_movements
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY date_trunc('month', ("createdAt" AT TIME ZONE 'Europe/Oslo'))
      ORDER BY date ASC
    `;
    return monthlyMovements.map((row) => ({
      date: row.date.toLocaleDateString("nb-NO", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
      in: Number(row.in_count),
      out: Number(row.out_count),
    }));
  }

  const dailyMovements = await prisma.$queryRaw<
    Array<{ date: Date; in_count: bigint; out_count: bigint }>
  >`
    SELECT
      ("createdAt" AT TIME ZONE 'Europe/Oslo')::date as date,
      COUNT(*) FILTER (WHERE type = 'IN') as in_count,
      COUNT(*) FILTER (WHERE type = 'OUT') as out_count
    FROM stock_movements
    WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
    GROUP BY ("createdAt" AT TIME ZONE 'Europe/Oslo')::date
    ORDER BY date ASC
  `;

  return dailyMovements.map((row) => ({
    date: row.date.toLocaleDateString("nb-NO", { day: "numeric", month: "short", timeZone: "UTC" }),
    in: Number(row.in_count),
    out: Number(row.out_count),
  }));
}

async function getMovementQuantityTrendData(mode: ChartPeriodMode, offset: number) {
  const { start, end } = osloPeriodUtcBounds(mode, offset);

  if (mode === "year") {
    const monthly = await prisma.$queryRaw<
      Array<{ date: Date; in_qty: unknown; out_qty: unknown }>
    >`
      SELECT
        (date_trunc('month', ("createdAt" AT TIME ZONE 'Europe/Oslo')))::date as date,
        COALESCE(SUM(quantity) FILTER (WHERE type = 'IN'), 0) as in_qty,
        COALESCE(SUM(quantity) FILTER (WHERE type = 'OUT'), 0) as out_qty
      FROM stock_movements
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY date_trunc('month', ("createdAt" AT TIME ZONE 'Europe/Oslo'))
      ORDER BY date ASC
    `;
    return monthly.map((row) => ({
      date: row.date.toLocaleDateString("nb-NO", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
      inQty: Number(row.in_qty),
      outQty: Number(row.out_qty),
    }));
  }

  const daily = await prisma.$queryRaw<Array<{ date: Date; in_qty: unknown; out_qty: unknown }>>`
    SELECT
      ("createdAt" AT TIME ZONE 'Europe/Oslo')::date as date,
      COALESCE(SUM(quantity) FILTER (WHERE type = 'IN'), 0) as in_qty,
      COALESCE(SUM(quantity) FILTER (WHERE type = 'OUT'), 0) as out_qty
    FROM stock_movements
    WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
    GROUP BY ("createdAt" AT TIME ZONE 'Europe/Oslo')::date
    ORDER BY date ASC
  `;

  return daily.map((row) => ({
    date: row.date.toLocaleDateString("nb-NO", { day: "numeric", month: "short", timeZone: "UTC" }),
    inQty: Number(row.in_qty),
    outQty: Number(row.out_qty),
  }));
}

function aggregateReceiveBacklogBuckets(rows: { updatedAt: Date }[]): ReceiveBacklogAgeBuckets {
  const buckets: ReceiveBacklogAgeBuckets = {
    on_track: 0,
    attention: 0,
    stalled: 0,
  };
  const now = Date.now();
  for (const row of rows) {
    const days = Math.floor((now - row.updatedAt.getTime()) / 86_400_000);
    buckets[receivingPipelineAgingTier(days)] += 1;
  }
  return buckets;
}

async function getDashboardData(mode: ChartPeriodMode, offset: number) {
  const [
    totalProducts,
    lowStockRaw,
    pendingPOs,
    activeProjects,
    todayAttendance,
    recentMovements,
    receiveBacklogRows,
  ] = await Promise.all([
    // Total active products
    prisma.product.count({ where: { isActive: true } }),

    // Products at or below reorder point (per location) — raw query needed for column comparison
    prisma.$queryRaw<
      Array<{
        id: string;
        quantity: number;
        reorderPoint: number;
        productName: string;
        productSku: string;
        locationName: string;
        unitSymbol: string;
      }>
    >`
      SELECT s.id, s.quantity, s."reorderPoint",
             p.name as "productName", p.sku as "productSku",
             l.name as "locationName",
             u.symbol as "unitSymbol"
      FROM stock s
      JOIN products p ON s."productId" = p.id
      JOIN units u ON p."unitId" = u.id
      JOIN locations l ON s."locationId" = l.id
      WHERE s.quantity <= s."reorderPoint" AND s."reorderPoint" > 0
      ORDER BY s.quantity ASC
      LIMIT 10
    `,

    // Pending purchase orders
    prisma.purchaseOrder.count({
      where: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } },
    }),

    // Active projects
    prisma.project.count({ where: { status: "IN_PROGRESS" } }),

    // Today's present employees (Oslo calendar day — matches @db.Date attendance rows)
    prisma.attendance.count({
      where: {
        date: { equals: todayOsloPrismaDate() },
        status: "PRESENT",
      },
    }),

    // Last 10 stock movements
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        stock: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                unit: { select: { symbol: true } },
              },
            },
            location: { select: { name: true } },
          },
        },
        user: { select: { name: true } },
      },
    }),

    prisma.purchaseOrder.findMany({
      where: { status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
      select: { updatedAt: true },
    }),
  ]);

  const [chartData, quantityChartData] = await Promise.all([
    getMovementTrendData(mode, offset),
    getMovementQuantityTrendData(mode, offset),
  ]);

  const receiveBacklogBuckets = aggregateReceiveBacklogBuckets(receiveBacklogRows);

  // Normalise low-stock rows for the template
  const lowStockItems = lowStockRaw.map((r) => ({
    id: r.id,
    quantity: r.quantity,
    reorderPoint: r.reorderPoint,
    product: { name: r.productName, sku: r.productSku, unitSymbol: r.unitSymbol },
    location: { name: r.locationName },
  }));

  return {
    totalProducts,
    lowStockItems,
    pendingPOs,
    activeProjects,
    todayAttendance,
    recentMovements,
    chartData,
    quantityChartData,
    receiveBacklogBuckets,
    chartPeriod: {
      mode,
      offset,
      title: formatChartPeriodTitle(mode, offset),
      detail: formatChartPeriodRangeDetail(mode, offset),
      bucket: mode === "year" ? ("month" as const) : ("day" as const),
    },
  };
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { mode, offset } = parseChartPeriod(sp);
  const data = await getDashboardData(mode, offset);
  const session = await auth();
  const showManagerHub = canAccessManagerHub(session?.user?.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Oversikt ${new Date().toLocaleDateString("nb-NO", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: BUSINESS_TIME_ZONE,
        })}`}
        actions={
          showManagerHub ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/manager">
                <Building2 className="mr-1.5 h-4 w-4" />
                Manager hub
              </Link>
            </Button>
          ) : undefined
        }
      />

      <ViewerWatchlistSection />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Total Products"
          value={data.totalProducts}
          icon={Package}
          description="Active in catalog"
        />
        <StatsCard
          title="Low Stock Alerts"
          value={data.lowStockItems.length}
          icon={AlertTriangle}
          variant={data.lowStockItems.length > 0 ? "warning" : "default"}
          description="Items below reorder point"
        />
        <StatsCard
          title="Pending Orders"
          value={data.pendingPOs}
          icon={ShoppingCart}
          variant={data.pendingPOs > 5 ? "warning" : "default"}
          description="Purchase orders open"
        />
        <StatsCard
          title="Active Projects"
          value={data.activeProjects}
          icon={FolderKanban}
          description="Projects in progress"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Stock Movements Chart ── */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ArrowUpDown className="text-primary h-4 w-4" />
                  Movement activity — {data.chartPeriod.title}
                </CardTitle>
                <p className="text-muted-foreground mt-1 text-xs">{data.chartPeriod.detail}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Count of stock movement rows (IN vs OUT) per{" "}
                  {data.chartPeriod.bucket === "month" ? "calendar month" : "day"} (Oslo).
                </p>
                {data.chartPeriod.bucket === "month" && (
                  <p className="text-muted-foreground text-xs">
                    Monthly totals (Oslo calendar year)
                  </p>
                )}
              </div>
              <ChartPeriodToolbar
                pathname="/dashboard"
                mode={data.chartPeriod.mode}
                offset={data.chartPeriod.offset}
              />
            </div>
          </CardHeader>
          <CardContent>
            <StockTrendChart
              data={data.chartData}
              xGranularity={data.chartPeriod.bucket === "month" ? "month" : "day"}
            />
          </CardContent>
        </Card>

        {/* ── Low Stock Alerts ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="text-warning-foreground h-4 w-4" />
              Low Stock Alerts
              {data.lowStockItems.length > 0 && (
                <Badge
                  variant="secondary"
                  className="border-warning/40 bg-warning/15 text-warning-foreground ml-auto text-[10px]"
                >
                  {data.lowStockItems.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.lowStockItems.length === 0 ? (
              <div className="text-muted-foreground px-6 py-10 pb-6 text-center text-sm">
                All stock levels are healthy
              </div>
            ) : (
              <div className="divide-border divide-y">
                {data.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <div className="text-foreground truncate text-sm font-medium">
                        {item.product.name}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {item.location.name} · {item.product.sku}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-warning-foreground text-sm font-semibold">
                        {formatQuantityNbNo(Number(item.quantity), item.product.unitSymbol)}{" "}
                        {item.product.unitSymbol} igjen
                      </div>
                      <div className="text-muted-foreground text-xs">
                        min {formatQuantityNbNo(Number(item.reorderPoint), item.product.unitSymbol)}{" "}
                        {item.product.unitSymbol}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ArrowUpDown className="text-primary h-4 w-4" />
                  Movement volume — {data.chartPeriod.title}
                </CardTitle>
                <p className="text-muted-foreground mt-1 text-xs">{data.chartPeriod.detail}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Sum of movement quantities on IN vs OUT lines (mixed catalog units). Transfers and
                  other types are not included.
                </p>
              </div>
              <ChartPeriodToolbar
                pathname="/dashboard"
                mode={data.chartPeriod.mode}
                offset={data.chartPeriod.offset}
              />
            </div>
          </CardHeader>
          <CardContent>
            <StockQuantityTrendChart
              data={data.quantityChartData}
              xGranularity={data.chartPeriod.bucket === "month" ? "month" : "day"}
              unitSymbol=""
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Receive backlog age</CardTitle>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Purchase orders with status ORDERED or PARTIALLY_RECEIVED (still waiting on goods).
              Buckets use calendar days since the PO was last updated — same thresholds as the
              manager hub (Due soon ≥4d, Over SLA ≥7d).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReceiveBacklogAgeChart buckets={data.receiveBacklogBuckets} />
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/purchase-orders">Open purchase orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Movements ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Stock Movements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentMovements.length === 0 ? (
            <div className="text-muted-foreground px-6 py-8 pb-6 text-center text-sm">
              No movements recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border bg-muted/30 border-b">
                    {["Product", "Location", "Type", "Quantity", "By", "Date"].map((h) => (
                      <th
                        key={h}
                        className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {data.recentMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="text-foreground font-medium">{m.stock.product.name}</div>
                        <div className="text-muted-foreground text-xs">{m.stock.product.sku}</div>
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5">{m.stock.location.name}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={m.type} />
                      </td>
                      <td className="px-4 py-2.5 font-mono font-medium">
                        {movementQuantityDisplayPrefix(m.type)}
                        {formatQuantityNbNo(Number(m.quantity), m.stock.product.unit.symbol)}{" "}
                        {m.stock.product.unit.symbol}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5">
                        {m.user?.name ?? "System"}
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5">
                        {m.createdAt.toLocaleString("nb-NO", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: BUSINESS_TIME_ZONE,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
