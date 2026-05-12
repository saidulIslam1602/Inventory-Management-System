/**
 * StockLocationSummary — compact card showing stock health per location.
 * Used in the inventory page header row.
 */

import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface StockLocationSummaryProps {
  id: string;
  name: string;
  totalItems: number;
  lowStockCount: number;
}

export function StockLocationSummary({ name, totalItems, lowStockCount }: StockLocationSummaryProps) {
  const hasAlerts = lowStockCount > 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-center transition-colors",
        hasAlerts
          ? "border-yellow-200 bg-yellow-50"
          : "border-border bg-card"
      )}
    >
      <div className={cn("text-xs font-medium truncate mb-1", hasAlerts ? "text-yellow-800" : "text-muted-foreground")}>
        {name}
      </div>
      <div className={cn("text-lg font-bold leading-none", hasAlerts ? "text-yellow-700" : "text-foreground")}>
        {totalItems}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">items</div>
      {hasAlerts && (
        <div className="flex items-center justify-center gap-1 mt-1.5 text-[10px] text-yellow-700 font-medium">
          <AlertTriangle className="h-2.5 w-2.5" />
          {lowStockCount} low
        </div>
      )}
    </div>
  );
}
