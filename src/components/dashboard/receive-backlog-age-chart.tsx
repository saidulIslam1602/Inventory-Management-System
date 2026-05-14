"use client";

/**
 * Receive backlog aging — counts of open-for-receipt POs by SLA tier (read-only).
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { managerPendingAgingLabel, type ManagerPendingAgingTier } from "@/lib/manager-aging";

export type ReceiveBacklogAgeBuckets = Record<ManagerPendingAgingTier, number>;

const ORDER: ManagerPendingAgingTier[] = ["on_track", "attention", "stalled"];

const BAR_FILL: Record<ManagerPendingAgingTier, string> = {
  on_track: "#16a34a",
  attention: "#f59e0b",
  stalled: "#dc2626",
};

export function ReceiveBacklogAgeChart({ buckets }: { buckets: ReceiveBacklogAgeBuckets }) {
  const total = ORDER.reduce((s, k) => s + buckets[k], 0);

  const data = ORDER.map((key) => ({
    key,
    name: managerPendingAgingLabel(key),
    value: buckets[key],
    fill: BAR_FILL[key],
  }));

  if (total === 0) {
    return (
      <div className="text-muted-foreground flex h-[200px] items-center justify-center text-center text-sm">
        No purchase orders waiting on receipt
      </div>
    );
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.15)" }}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            formatter={(value) => {
              const n = Number(value ?? 0);
              return [`${n} PO${n === 1 ? "" : "s"}`, "Open for receipt"];
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
