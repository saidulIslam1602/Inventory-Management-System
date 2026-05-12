"use client";

/**
 * StockTrendChart — Recharts area chart showing IN/OUT movements by Oslo calendar day or month.
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

interface ChartDataPoint {
  date: string;
  in: number;
  out: number;
}

interface StockTrendChartProps {
  data: ChartDataPoint[];
  /** Bucketing of the X axis labels (year view = one point per calendar month). */
  xGranularity?: "day" | "month";
}

export function StockTrendChart({ data, xGranularity = "day" }: StockTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        No movement data available yet
      </div>
    );
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            {/* Gradient fills using Aqila green */}
            <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2D7D46" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#2D7D46" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
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
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
          />
          <Area
            type="monotone"
            dataKey="in"
            name="Stock In"
            stroke="#2D7D46"
            strokeWidth={2}
            fill="url(#gradIn)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="out"
            name="Stock Out"
            stroke="#EF4444"
            strokeWidth={2}
            fill="url(#gradOut)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
