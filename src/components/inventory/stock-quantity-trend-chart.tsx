"use client";

/**
 * StockQuantityTrendChart — Recharts area chart for summed movement quantities (IN vs OUT).
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatQuantityNbNo } from "@/lib/utils";

export interface StockQuantityChartPoint {
  date: string;
  inQty: number;
  outQty: number;
}

interface StockQuantityTrendChartProps {
  data: StockQuantityChartPoint[];
  /** Bucketing of the X axis labels (year view = one point per calendar month). */
  xGranularity?: "day" | "month";
  /** Unit symbol shown in tooltips (same catalog units apply across rows). */
  unitSymbol?: string;
}

export function StockQuantityTrendChart({
  data,
  xGranularity = "day",
  unitSymbol = "u",
}: StockQuantityTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        No movement quantities in this period
      </div>
    );
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradQtyIn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2D7D46" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#2D7D46" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradQtyOut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))",
              angle: xGranularity === "month" ? -35 : 0,
              textAnchor: xGranularity === "month" ? "end" : "middle",
            }}
            height={xGranularity === "month" ? 48 : 28}
            axisLine={false}
            tickLine={false}
            interval={xGranularity === "month" ? 0 : "preserveStartEnd"}
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
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              const key = String(name ?? "");
              return [
                `${formatQuantityNbNo(n, unitSymbol)}${unitSymbol ? ` ${unitSymbol}` : ""}`,
                key === "inQty" ? "Qty in (IN)" : "Qty out (OUT)",
              ];
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
            formatter={(value) => (value === "inQty" ? "Quantity in (IN)" : "Quantity out (OUT)")}
          />
          <Area
            type="monotone"
            dataKey="inQty"
            name="inQty"
            stroke="#2D7D46"
            strokeWidth={2}
            fill="url(#gradQtyIn)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="outQty"
            name="outQty"
            stroke="#EF4444"
            strokeWidth={2}
            fill="url(#gradQtyOut)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
