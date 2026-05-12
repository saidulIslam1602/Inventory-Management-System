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
  warning: "text-yellow-600",
  danger: "text-destructive",
  success: "text-primary",
};

const VARIANT_BG = {
  default: "bg-primary/10",
  warning: "bg-yellow-50",
  danger: "bg-destructive/10",
  success: "bg-primary/10",
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

  const TrendIcon =
    trend
      ? trend.value > 0
        ? TrendingUp
        : trend.value < 0
          ? TrendingDown
          : Minus
      : null;

  const trendColor =
    trend
      ? trend.value > 0
        ? "text-primary"
        : trend.value < 0
          ? "text-destructive"
          : "text-muted-foreground"
      : "";

  return (
    <Card className={cn("border border-border shadow-none", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground text-sm font-medium truncate">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1 leading-none">{value}</p>
            {description && (
              <p className="text-muted-foreground text-xs mt-1.5">{description}</p>
            )}
            {trend && TrendIcon && (
              <div className={cn("flex items-center gap-1 mt-2 text-xs", trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>
                  {Math.abs(trend.value)}% {trend.label}
                </span>
              </div>
            )}
          </div>
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ml-4", bgClass)}>
            <Icon className={cn("h-5 w-5", colorClass)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
