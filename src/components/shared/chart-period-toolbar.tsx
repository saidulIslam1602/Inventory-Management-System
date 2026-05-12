/**
 * Period selector for dashboard / reports charts (URL: ?period=month|quarter|year&offset=n).
 */

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChartPeriodMode } from "@/lib/chart-period";

const MODES: { id: ChartPeriodMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
];

export function ChartPeriodToolbar({
  pathname,
  mode,
  offset,
  className,
}: {
  pathname: string;
  mode: ChartPeriodMode;
  offset: number;
  className?: string;
}) {
  const q = (m: ChartPeriodMode, o: number) =>
    `${pathname}?${new URLSearchParams({ period: m, offset: String(o) }).toString()}`;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="border-border bg-muted/40 inline-flex rounded-lg border p-0.5">
        {MODES.map(({ id, label }) => (
          <Button
            key={id}
            variant={mode === id ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            asChild
          >
            <Link href={q(id, 0)}>{label}</Link>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={offset <= 0} asChild>
          <Link
            href={q(mode, Math.max(0, offset - 1))}
            aria-label="Newer period"
            title="Newer period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" asChild>
          <Link href={q(mode, offset + 1)} aria-label="Older period" title="Older period">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
