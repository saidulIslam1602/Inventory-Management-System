"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllMyNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";
import { cn } from "@/lib/utils";

type ApiNotification = {
  id: string;
  title: string;
  message: string;
  actionHref: string | null;
  isRead: boolean;
  createdAt: string;
};

export function HeaderNotificationsMenu({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const openRef = React.useRef(false);

  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  /** Monotonic stamp so stale responses cannot overwrite newer fetches after rapid open/path changes */
  const fetchGen = React.useRef(0);

  const [items, setItems] = React.useState<ApiNotification[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadNotifications = React.useCallback(() => {
    const seq = ++fetchGen.current;
    setLoading(true);
    void fetch("/api/notifications/recent")
      .then((r) => r.json() as Promise<{ notifications: ApiNotification[] }>)
      .then((j) => {
        if (seq !== fetchGen.current) return;
        setItems(j.notifications ?? []);
      })
      .catch(() => {
        if (seq !== fetchGen.current) return;
        setItems([]);
      })
      .finally(() => {
        if (seq !== fetchGen.current) return;
        setLoading(false);
      });
  }, []);

  // Refetch when route changes while the menu is still open — deferred so setState stays out of effect body
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      if (!openRef.current) return;
      loadNotifications();
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname, loadNotifications]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      loadNotifications();
    }
  }

  async function onOpenRow(id: string, href: string, isRead: boolean) {
    if (!isRead) await markNotificationRead(id);
    setOpen(false);
    router.push(href);
    router.refresh();
  }

  async function onMarkAll() {
    await markAllMyNotificationsRead();
    setItems((prev) => (prev ? prev.map((n) => ({ ...n, isRead: true })) : prev));
    router.refresh();
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        className={cn(
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge className="bg-destructive text-destructive-foreground border-background pointer-events-none absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(24rem,calc(100vh-5rem))] w-[min(22rem,calc(100vw-2rem))]"
        sideOffset={6}
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-2 font-normal">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 shrink-0 px-2 text-xs"
              onClick={(e) => {
                e.preventDefault();
                void onMarkAll();
              }}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto">
          {loading || items === null ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              No notifications yet.
            </p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
                onClick={() =>
                  void onOpenRow(n.id, n.actionHref ?? "/me#portal-notifications", n.isRead)
                }
              >
                <span className="flex w-full items-start gap-2">
                  <span className="line-clamp-1 flex-1 text-sm font-medium">{n.title}</span>
                  {!n.isRead ? (
                    <span className="bg-primary mt-1.5 h-2 w-2 shrink-0 rounded-full" aria-hidden />
                  ) : null}
                </span>
                <span className="text-muted-foreground line-clamp-2 w-full text-xs">
                  {n.message}
                </span>
                <span className="text-muted-foreground/80 text-[10px]">
                  {new Date(n.createdAt).toLocaleString("nb-NO", {
                    timeZone: BUSINESS_TIME_ZONE,
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            router.push("/me#portal-notifications");
          }}
        >
          Open My portal — all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
