/**
 * Simple SLA-style aging for manager hub pending approvals and receiving pipeline.
 * Thresholds align with accent rules in `buildManagerDecisionQueue`.
 */

export type ManagerPendingAgingTier = "on_track" | "attention" | "stalled";

/** Submitted PO waiting approval — breach at 3d waiting (matches scoring warning accent). */
export function pendingApprovalAgingTier(daysWaiting: number): ManagerPendingAgingTier {
  if (daysWaiting >= 3) return "stalled";
  if (daysWaiting >= 2) return "attention";
  return "on_track";
}

/**
 * Ordered / partially received — age is calendar days since PO `updatedAt`
 * (matches receive backlog copy). Breach at 7d (matches decision queue warning).
 */
export function receivingPipelineAgingTier(daysSinceUpdate: number): ManagerPendingAgingTier {
  if (daysSinceUpdate >= 7) return "stalled";
  if (daysSinceUpdate >= 4) return "attention";
  return "on_track";
}

export function managerPendingAgingLabel(tier: ManagerPendingAgingTier): string {
  switch (tier) {
    case "on_track":
      return "On track";
    case "attention":
      return "Due soon";
    case "stalled":
      return "Over SLA";
  }
}

/** Left accent + subtle fill for list rows (manager hub cards). */
export function managerPendingRowAccentClass(tier: ManagerPendingAgingTier): string {
  if (tier === "stalled") {
    return "border-border/60 border-l-destructive bg-destructive/[0.06] border-l-[3px]";
  }
  if (tier === "attention") {
    return "border-border/60 border-l-amber-500 bg-amber-500/[0.07] border-l-[3px] dark:border-l-amber-500/90";
  }
  return "border-border/60";
}
