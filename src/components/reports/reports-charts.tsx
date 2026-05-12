"use client";

/**
 * ReportsCharts — client component containing all report visualizations.
 * Uses Recharts: bar charts, pie charts, and summary cards.
 * Includes CSV export for each dataset.
 */

import { Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartPeriodMode } from "@/lib/chart-period";

// Aqila-brand color palette for charts
const COLORS = ["#2D7D46", "#4CAF72", "#7DCF98", "#A8E0BE", "#D0F0DC", "#1A5C34", "#0F3D22"];
const ATTENDANCE_COLORS: Record<string, string> = {
  PRESENT: "#2D7D46",
  ABSENT: "#EF4444",
  LATE: "#F59E0B",
  HALF_DAY: "#3B82F6",
  LEAVE: "#8B5CF6",
};

interface ReportData {
  movementsByType: Array<{ type: string; count: number }>;
  topConsumedProducts: Array<{ name: string; value: number }>;
  poSpendBySupplier: Array<{ name: string; value: number }>;
  attendanceSummary: Array<{ status: string; count: number }>;
  stockValueByCategory: Array<{ name: string; value: number }>;
  incomingGoods: {
    valueNok: number;
    quantityIn: number;
    linesWithCost: number;
    linesNoCost: number;
  };
  chartPeriod: {
    mode: ChartPeriodMode;
    offset: number;
    title: string;
    detail: string;
    startYmd: string;
    endYmd: string;
  };
}

interface ReportsChartsProps {
  data: ReportData;
}

/** Download any dataset as a CSV file */
function downloadCSV(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsCharts({ data }: ReportsChartsProps) {
  const csvSuffix = `${data.chartPeriod.startYmd}_${data.chartPeriod.endYmd}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Incoming goods value (IN)
            </CardTitle>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              kr {data.incomingGoods.valueNok.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}
            </p>
          </CardHeader>
          <CardContent className="text-muted-foreground pt-0 text-xs">
            Total of quantity × unit cost on IN movements (purchase orders, receive screen, etc.).
            {data.incomingGoods.linesNoCost > 0 ? (
              <span className="mt-1 block text-amber-700 dark:text-amber-400">
                {data.incomingGoods.linesNoCost} line(s) missing unit cost — totals exclude those
                lines.
              </span>
            ) : null}
          </CardContent>
        </Card>
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Quantity received (IN)
            </CardTitle>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {data.incomingGoods.quantityIn.toLocaleString("nb-NO")}
            </p>
          </CardHeader>
          <CardContent className="text-muted-foreground pt-0 text-xs">
            {data.incomingGoods.linesWithCost + data.incomingGoods.linesNoCost > 0
              ? `${data.incomingGoods.linesWithCost + data.incomingGoods.linesNoCost} IN movement(s); ${data.incomingGoods.linesWithCost} with unit cost.`
              : "No IN movements in this period."}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 1: Movements by type + Attendance ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Movements by Type */}
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-row items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <CardTitle className="text-base font-semibold">Stock movements by type</CardTitle>
                <p className="text-muted-foreground text-xs font-normal">
                  {data.chartPeriod.title}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground h-7 w-7 shrink-0"
                onClick={() =>
                  downloadCSV(`movements-by-type_${csvSuffix}.csv`, data.movementsByType)
                }
                title="Export CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.movementsByType.length === 0 ? (
              <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
                No stock movements in this period
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.movementsByType}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="type"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" name="Count" fill="#2D7D46" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Summary Pie */}
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-row items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <CardTitle className="text-base font-semibold">Attendance</CardTitle>
                <p className="text-muted-foreground text-xs font-normal">
                  {data.chartPeriod.title}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground h-7 w-7 shrink-0"
                onClick={() =>
                  downloadCSV(`attendance-summary_${csvSuffix}.csv`, data.attendanceSummary)
                }
                title="Export CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.attendanceSummary.length === 0 ? (
              <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
                No attendance recorded for this period
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.attendanceSummary.map((r) => ({ name: r.status, value: r.count }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {data.attendanceSummary.map((entry) => (
                        <Cell key={entry.status} fill={ATTENDANCE_COLORS[entry.status] ?? "#ccc"} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Top consumed products ── */}
      <Card className="border-border border shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-row items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="text-base font-semibold">Top 10 consumed products</CardTitle>
              <p className="text-muted-foreground text-xs font-normal">{data.chartPeriod.title}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-7 w-7 shrink-0"
              onClick={() => downloadCSV(`top-consumed_${csvSuffix}.csv`, data.topConsumedProducts)}
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.topConsumedProducts.length === 0 ? (
            <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
              No consumption data in this period
            </div>
          ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topConsumedProducts}
                  layout="vertical"
                  margin={{ top: 4, right: 40, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={160}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" name="Units consumed" fill="#2D7D46" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Row 3: PO Spend + Stock Value by Category ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-row items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <CardTitle className="text-base font-semibold">PO spend by supplier</CardTitle>
                <p className="text-muted-foreground text-xs font-normal">
                  {data.chartPeriod.title}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground h-7 w-7 shrink-0"
                onClick={() =>
                  downloadCSV(`po-spend-by-supplier_${csvSuffix}.csv`, data.poSpendBySupplier)
                }
                title="Export CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.poSpendBySupplier.length === 0 ? (
              <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
                No received purchase orders in this period
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.poSpendBySupplier}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.poSpendBySupplier.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        `kr ${Number(value).toLocaleString("nb-NO")}`,
                        "Spend",
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex flex-row items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <CardTitle className="text-base font-semibold">Stock value by category</CardTitle>
                <p className="text-muted-foreground text-xs font-normal">
                  Current inventory snapshot — not tied to the period selector
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground h-7 w-7 shrink-0"
                onClick={() =>
                  downloadCSV(`stock-value-by-category_${csvSuffix}.csv`, data.stockValueByCategory)
                }
                title="Export CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.stockValueByCategory.length === 0 ? (
              <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
                No stock data
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.stockValueByCategory}
                    margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `kr ${Number(value).toLocaleString("nb-NO")}`,
                        "Value",
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      name="Stock value (kr)"
                      fill="#2D7D46"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
