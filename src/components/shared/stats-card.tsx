/**
 * StatsCard — KPI card for the dashboard.
 * Shows a metric with icon, label, value, and optional trend.
 */

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: { value: number; label: string };
  variant?: "default" | "warning" | "danger" | "success";
  className?: string;
}

const VARIANT_STYLES = {
  default: "text-primary",
  warning: "text-warning-foreground",
  danger: "text-destructive",
  success: "text-success",
};

const VARIANT_BG = {
  default: "bg-primary/10",
  warning: "bg-warning/18",
  danger: "bg-destructive/10",
  success: "bg-success/15",
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = "default",
  className,
}: StatsCardProps) {
  const colorClass = VARIANT_STYLES[variant];
  const bgClass = VARIANT_BG[variant];

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
        ? TrendingDown
        : Minus
    : null;

  const trendColor = trend
    ? trend.value > 0
      ? "text-success"
      : trend.value < 0
        ? "text-destructive"
        : "text-muted-foreground"
    : "";

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground truncate text-sm font-medium">{title}</p>
            <p className="text-foreground mt-1 text-2xl font-bold leading-none">{value}</p>
            {description && <p className="text-muted-foreground mt-1.5 text-xs">{description}</p>}
            {trend && TrendIcon && (
              <div className={cn("mt-2 flex items-center gap-1 text-xs", trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>
                  {Math.abs(trend.value)}% {trend.label}
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              bgClass
            )}
          >
            <Icon className={cn("h-5 w-5", colorClass)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
