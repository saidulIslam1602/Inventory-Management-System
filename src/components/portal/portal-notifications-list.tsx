"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotificationType } from "@prisma/client";
import { ExternalLink, CheckCheck } from "lucide-react";
import { markAllMyNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";

export type PortalNotificationItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionHref: string | null;
  type: NotificationType;
};

type CategoryFilter = "all" | "po" | "digest" | "other";

function categoryForType(t: NotificationType): CategoryFilter {
  if (
    t === "PO_SUBMITTED" ||
    t === "PO_APPROVED" ||
    t === "PO_ORDERED" ||
    t === "PO_RECEIVED" ||
    t === "PO_APPROVAL_OVERDUE"
  ) {
    return "po";
  }
  if (t === "DAILY_DIGEST") return "digest";
  return "other";
}

export function PortalNotificationsList({ items }: { items: PortalNotificationItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [pendingAll, setPendingAll] = React.useState(false);
  const [filter, setFilter] = React.useState<CategoryFilter>("all");
  const [hideRead, setHideRead] = React.useState(false);

  async function onMarkOne(id: string) {
    setPendingId(id);
    await markNotificationRead(id);
    setPendingId(null);
    router.refresh();
  }

  async function onMarkAll() {
    setPendingAll(true);
    await markAllMyNotificationsRead();
    setPendingAll(false);
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No notifications.</p>;
  }

  const visible = items.filter((n) => {
    if (hideRead && n.isRead) return false;
    if (filter === "all") return true;
    return categoryForType(n.type) === filter;
  });

  const hasUnread = items.some((n) => !n.isRead);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["po", "PO"],
              ["digest", "Digest"],
              ["other", "Other"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={filter === id ? "secondary" : "outline"}
              className="h-8 text-xs"
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox
            checked={hideRead}
            onCheckedChange={(v) => setHideRead(v === true)}
            className="border-muted-foreground/50"
          />
          Hide read
        </label>
      </div>
      {hasUnread ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={pendingAll}
            onClick={() => void onMarkAll()}
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">No notifications match these filters.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((n) => (
            <li key={n.id} className="border-border/50 border-b pb-3 text-sm last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{n.title}</div>
                  <p className="text-muted-foreground mt-0.5 text-xs">{n.message}</p>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                    <span>
                      {new Date(n.createdAt).toLocaleString("nb-NO", {
                        timeZone: BUSINESS_TIME_ZONE,
                      })}
                    </span>
                    {n.actionHref ? (
                      <Link
                        href={n.actionHref}
                        onClick={() => {
                          if (!n.isRead) void markNotificationRead(n.id);
                        }}
                        className="text-primary inline-flex items-center gap-0.5 font-medium hover:underline"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}
                    {!n.isRead ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-auto px-1 py-0 text-[10px]"
                        disabled={pendingId === n.id}
                        onClick={() => void onMarkOne(n.id)}
                      >
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </div>
                {!n.isRead ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    New
                  </Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
