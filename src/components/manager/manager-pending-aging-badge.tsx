import { Badge } from "@/components/ui/badge";
import { managerPendingAgingLabel, type ManagerPendingAgingTier } from "@/lib/manager-aging";

export function ManagerPendingAgingBadge({
  tier,
  className,
}: {
  tier: ManagerPendingAgingTier;
  className?: string;
}) {
  const variant =
    tier === "stalled" ? "destructive" : tier === "attention" ? "outline" : "secondary";
  const outlineAmber =
    tier === "attention"
      ? "border-amber-500/40 text-amber-950 dark:border-amber-500/50 dark:text-amber-200"
      : "";

  return (
    <Badge
      variant={variant}
      className={`text-[10px] font-semibold tracking-tight ${outlineAmber} ${className ?? ""}`}
    >
      {managerPendingAgingLabel(tier)}
    </Badge>
  );
}
