/**
 * StatusBadge — Color-coded badge for entity statuses (PO, Project, Attendance).
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { POStatus, ProjectStatus, AttendanceStatus } from "@prisma/client";

type Status = POStatus | ProjectStatus | AttendanceStatus | string;

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  // PO statuses — semantic tokens (readable in light and dark)
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  SUBMITTED: { label: "Submitted", className: "bg-info/15 text-info border-info/25" },
  APPROVED: { label: "Approved", className: "bg-primary/10 text-primary border-primary/20" },
  ORDERED: { label: "Ordered", className: "bg-primary/18 text-primary border-primary/28" },
  PARTIALLY_RECEIVED: {
    label: "Partial",
    className: "bg-warning/18 text-warning-foreground border-warning/30",
  },
  RECEIVED: { label: "Received", className: "bg-success/15 text-success border-success/25" },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive border-destructive/25",
  },
  // Project statuses
  PLANNING: { label: "Planning", className: "bg-info/15 text-info border-info/25" },
  IN_PROGRESS: { label: "In Progress", className: "bg-primary/10 text-primary border-primary/20" },
  COMPLETED: { label: "Completed", className: "bg-success/12 text-success border-success/25" },
  ON_HOLD: {
    label: "On Hold",
    className: "bg-warning/18 text-warning-foreground border-warning/30",
  },
  // Attendance statuses
  PRESENT: { label: "Present", className: "bg-success/12 text-success border-success/25" },
  ABSENT: {
    label: "Absent",
    className: "bg-destructive/10 text-destructive border-destructive/25",
  },
  LATE: { label: "Late", className: "bg-warning/18 text-warning-foreground border-warning/30" },
  HALF_DAY: { label: "Half Day", className: "bg-info/15 text-info border-info/25" },
  LEAVE: { label: "Leave", className: "bg-muted text-muted-foreground border-border" },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <Badge variant="outline" className={cn("text-xs font-medium", config.className, className)}>
      {config.label}
    </Badge>
  );
}
