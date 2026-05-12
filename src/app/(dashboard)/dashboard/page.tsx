/**
 * Dashboard page — entry point after login.
 * Renders KPI cards, low-stock alerts, recent movements, and a stock trend chart.
 * All data is fetched server-side for fast initial load.
 */

import type { Metadata } from "next";
import { Package, ShoppingCart, Users, FolderKanban, AlertTriangle, ArrowUpDown } from "lucide-react";
import { prisma } from "@/lib/db";
import { StatsCard } from "@/components/shared/stats-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StockTrendChart } from "@/components/inventory/stock-trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";

export const metadata: Metadata = { title: "Dashboard" };

// Revalidate dashboard data every 60 seconds (ISR)
export const revalidate = 60;

async function getDashboardData() {
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [
    totalProducts,
    lowStockRaw,
    pendingPOs,
    activeProjects,
    todayAttendance,
    recentMovements,
    stockValueResult,
    monthlyMovements,
  ] = await Promise.all([
    // Total active products
    prisma.product.count({ where: { isActive: true } }),

    // Products at or below reorder point (per location) — raw query needed for column comparison
    prisma.$queryRaw<Array<{ id: string; quantity: number; reorderPoint: number; productName: string; productSku: string; locationName: string }>>`
      SELECT s.id, s.quantity, s."reorderPoint",
             p.name as "productName", p.sku as "productSku",
             l.name as "locationName"
      FROM stock s
      JOIN products p ON s."productId" = p.id
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

    // Today's present employees
    prisma.attendance.count({
      where: {
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
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
            product: { select: { name: true, sku: true } },
            location: { select: { name: true } },
          },
        },
        user: { select: { name: true } },
      },
    }),

    // Total stock value (sum of quantity * unitPrice per product)
    prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COALESCE(SUM(s.quantity * p."unitPrice"), 0) AS total
      FROM stock s
      JOIN products p ON s."productId" = p.id
    `,

    // Daily IN/OUT movement counts for the last 30 days
    prisma.$queryRaw<Array<{ date: Date; in_count: bigint; out_count: bigint }>>`
      SELECT
        DATE("createdAt") as date,
        COUNT(*) FILTER (WHERE type = 'IN') as in_count,
        COUNT(*) FILTER (WHERE type = 'OUT') as out_count
      FROM stock_movements
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ]);

  const totalStockValue = Number(stockValueResult[0]?.total ?? 0);

  // Normalise low-stock rows for the template
  const lowStockItems = lowStockRaw.map((r) => ({
    id: r.id,
    quantity: r.quantity,
    reorderPoint: r.reorderPoint,
    product: { name: r.productName, sku: r.productSku },
    location: { name: r.locationName },
  }));

  // Format chart data
  const chartData = monthlyMovements.map((row) => ({
    date: format(row.date, "MMM d"),
    in: Number(row.in_count),
    out: Number(row.out_count),
  }));

  return {
    totalProducts,
    lowStockItems,
    pendingPOs,
    activeProjects,
    todayAttendance,
    recentMovements,
    totalStockValue,
    chartData,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Overview for ${format(new Date(), "EEEE, d MMMM yyyy")}`}
      />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Stock Movements Chart ── */}
        <Card className="lg:col-span-2 border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-primary" />
              Stock Movements — Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StockTrendChart data={data.chartData} />
          </CardContent>
        </Card>

        {/* ── Low Stock Alerts ── */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Low Stock Alerts
              {data.lowStockItems.length > 0 && (
                <Badge variant="destructive" className="ml-auto text-[10px]">
                  {data.lowStockItems.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.lowStockItems.length === 0 ? (
              <div className="px-6 pb-6 text-center text-muted-foreground text-sm py-8">
                All stock levels are healthy
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.lowStockItems.map((item) => (
                  <div key={item.id} className="px-6 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {item.product.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.location.name} · {item.product.sku}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-destructive">
                        {Number(item.quantity)} left
                      </div>
                      <div className="text-xs text-muted-foreground">
                        min {Number(item.reorderPoint)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Movements ── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Stock Movements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentMovements.length === 0 ? (
            <div className="px-6 pb-6 text-center text-muted-foreground text-sm py-8">
              No movements recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Product", "Location", "Type", "Quantity", "By", "Date"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recentMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{m.stock.product.name}</div>
                        <div className="text-xs text-muted-foreground">{m.stock.product.sku}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.stock.location.name}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={m.type} />
                      </td>
                      <td className="px-4 py-2.5 font-mono font-medium">
                        {m.type === "OUT" ? "-" : "+"}{Number(m.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.user?.name ?? "System"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {format(m.createdAt, "d MMM, HH:mm")}
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
