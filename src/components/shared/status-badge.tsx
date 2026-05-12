/**
 * StatusBadge — Color-coded badge for entity statuses (PO, Project, Attendance).
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { POStatus, ProjectStatus, AttendanceStatus } from "@prisma/client";

type Status = POStatus | ProjectStatus | AttendanceStatus | string;

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  // PO statuses
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  SUBMITTED: { label: "Submitted", className: "bg-blue-50 text-blue-700 border-blue-200" },
  APPROVED: { label: "Approved", className: "bg-primary/10 text-primary border-primary/20" },
  ORDERED: { label: "Ordered", className: "bg-primary/20 text-primary border-primary/30" },
  PARTIALLY_RECEIVED: { label: "Partial", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  RECEIVED: { label: "Received", className: "bg-primary/10 text-primary border-primary/30" },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
  // Project statuses
  PLANNING: { label: "Planning", className: "bg-blue-50 text-blue-700 border-blue-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-primary/10 text-primary border-primary/20" },
  COMPLETED: { label: "Completed", className: "bg-primary/20 text-primary border-primary/30" },
  ON_HOLD: { label: "On Hold", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  // Attendance statuses
  PRESENT: { label: "Present", className: "bg-primary/10 text-primary border-primary/20" },
  ABSENT: { label: "Absent", className: "bg-destructive/10 text-destructive border-destructive/20" },
  LATE: { label: "Late", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  HALF_DAY: { label: "Half Day", className: "bg-blue-50 text-blue-700 border-blue-200" },
  LEAVE: { label: "Leave", className: "bg-muted text-muted-foreground border-border" },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, className: "bg-muted text-muted-foreground" };

  return (
    <Badge
      variant="outline"
      className={cn("font-medium text-xs", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
