"use client";

import React, { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  subscribeReceiveQueue,
  snapshotReceiveQueueCount,
} from "@/lib/receive-offline-queue-storage";
import { flushReceiveOfflineQueue, isNavigatorOffline } from "@/lib/receive-offline-submit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

function useQueuedReceiveCount(userId: string): number {
  return useSyncExternalStore(
    (cb) => subscribeReceiveQueue(userId, cb),
    () => snapshotReceiveQueueCount(userId),
    () => 0
  );
}

export function ReceiveOfflineQueueBanner({ userId }: { userId: string }) {
  const router = useRouter();
  const count = useQueuedReceiveCount(userId);
  const [busy, setBusy] = React.useState(false);
  const running = React.useRef(false);

  const flush = React.useCallback(
    async (mode: "auto" | "manual") => {
      if (running.current) return;
      if (snapshotReceiveQueueCount(userId) === 0) return;
      if (isNavigatorOffline()) {
        if (mode === "manual") toast.error("Still offline — cannot sync receipts yet.");
        return;
      }

      running.current = true;
      queueMicrotask(() => setBusy(true));
      try {
        const result = await flushReceiveOfflineQueue(userId);
        if (result.flushedOk > 0) {
          router.refresh();
          if (mode === "manual" || result.flushedOk >= 3) {
            toast.success(
              `Synced ${result.flushedOk} queued receipt${result.flushedOk === 1 ? "" : "s"}.`
            );
          }
        }
        if (result.stoppedEarlyForNetwork) {
          toast.message(
            "Could not finish syncing — check your connection. Remaining receipts stay queued."
          );
        }
        if (result.droppedBusinessErrors.length > 0) {
          const excerpt = result.droppedBusinessErrors.slice(0, 2).join(" · ");
          const more = result.droppedBusinessErrors.length > 2 ? "…" : "";
          toast.error(`Some receipts could not sync: ${excerpt}${more}`);
        }
      } finally {
        running.current = false;
        queueMicrotask(() => setBusy(false));
      }
    },
    [userId, router]
  );

  React.useEffect(() => {
    if (count === 0 || isNavigatorOffline()) return;
    const timer = window.setTimeout(() => {
      void flush("auto");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [count, flush, userId]);

  React.useEffect(() => {
    const onOnline = (): void => {
      queueMicrotask(() => void flush("auto"));
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  if (count === 0 && !busy) return null;

  return (
    <Alert className="bg-amber-500/6 border-amber-500/25">
      <CloudOff
        className="mb-2 h-4 w-4 text-amber-700 sm:float-left sm:mb-0 sm:mr-2 dark:text-amber-400"
        aria-hidden
      />
      <AlertDescription className="text-foreground leading-relaxed">
        {count > 0 ? (
          <>
            <span className="font-medium">{count}</span> receipt{count === 1 ? "" : "s"} await sync
            on <span className="font-medium">this device only</span> — submitted in order when
            online. Receipts rejected by the server (closed PO, too much qty, …) drop from the queue
            and show an alert.
          </>
        ) : (
          <>Syncing queued receipts…</>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-3 min-h-9 w-full shrink-0 sm:ml-3 sm:mt-0 sm:inline-flex sm:w-auto"
          disabled={busy || count === 0 || isNavigatorOffline()}
          title={isNavigatorOffline() ? "Connect to the internet to sync." : undefined}
          onClick={() => void flush("manual")}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
              Syncing…
            </>
          ) : (
            "Sync now"
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
