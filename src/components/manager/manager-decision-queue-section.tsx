import Link from "next/link";
import { Inbox } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManagerPendingAgingBadge } from "@/components/manager/manager-pending-aging-badge";
import { managerPendingRowAccentClass } from "@/lib/manager-aging";
import { cn } from "@/lib/utils";
import type { ManagerDecisionQueueItem } from "@/lib/queries/manager-overview";

function queueBadgeOutlineClass(item: ManagerDecisionQueueItem): string {
  if (item.accent === "destructive") return "";
  if (item.accent === "warning") {
    return "border-amber-500/35 text-amber-800 dark:border-amber-500/45 dark:text-amber-400";
  }
  return "";
}

export function ManagerDecisionQueueSection({
  items,
  readOnly = false,
}: {
  items: ManagerDecisionQueueItem[];
  readOnly?: boolean;
}) {
  return (
    <Card id="manager-decision-inbox" className="border-primary/15 scroll-mt-28 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Inbox className="text-primary h-5 w-5" aria-hidden />
          Decision inbox
        </CardTitle>
        <CardDescription>
          Sorted “needs you” items — exceptions first, then PO approvals, receiving pipeline, then
          internal transfer hints. PO rows show SLA aging (approve 3d+, receive 7d+ since update).
          Rows already covered by stale / overdue exceptions are omitted elsewhere in this merge.
          {readOnly ? (
            <>
              {" "}
              <span className="text-muted-foreground font-normal">
                Viewer — destinations open read-only where your role allows writes.
              </span>
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Inbox clear — drill into the sections below for full backlog tables.
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-xl border">
            {items.map((item) => {
              const outline = queueBadgeOutlineClass(item);
              const variant =
                item.accent === "destructive"
                  ? "destructive"
                  : item.accent === "warning"
                    ? ("outline" as const)
                    : "secondary";

              const titleCls =
                item.kind === "po_approve" ||
                item.kind === "receive_backlog" ||
                item.kind === "transfer_suggested"
                  ? "font-mono text-sm font-semibold"
                  : "text-sm font-semibold";

              const slaRow =
                item.slaTier && (item.kind === "po_approve" || item.kind === "receive_backlog")
                  ? managerPendingRowAccentClass(item.slaTier)
                  : undefined;

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={cn(
                      "hover:bg-muted/35 flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-start sm:justify-between",
                      slaRow
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge
                          variant={variant}
                          className={`text-[10px] font-semibold capitalize ${outline}`}
                        >
                          {item.badge}
                        </Badge>
                        {item.slaTier &&
                        (item.kind === "po_approve" || item.kind === "receive_backlog") ? (
                          <ManagerPendingAgingBadge tier={item.slaTier} />
                        ) : null}
                        <span className={titleCls}>{item.title}</span>
                        {item.meta ? (
                          <span className="text-muted-foreground whitespace-nowrap text-xs">
                            · {item.meta}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-foreground max-w-[56rem] text-sm">{item.subtitle}</p>
                    </div>
                    <span className="text-primary shrink-0 text-sm font-medium sm:pt-0.5">
                      Open →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
