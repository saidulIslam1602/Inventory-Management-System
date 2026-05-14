"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, PackageOpen } from "lucide-react";
import { submitPoReceiveWithOffline } from "@/lib/receive-offline-submit";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatQuantityNbNo } from "@/lib/utils";
import {
  PO_RECEIVE_CONFIRM_LINE_QTY_MIN,
  findPoReceiveLinesNeedingConfirm,
  type PoConfirmLineHit,
} from "@/lib/receive-confirm-rules";

type Line = {
  id: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
  product: { name: string; sku: string; unit: { symbol: string } };
};

export type PurchaseOrderReceiveLinePayload = Line;

export function PurchaseOrderReceiveForm({
  purchaseOrderId,
  lines,
  finalizeMode = "post",
  onRequestReview,
  offlineQueueUserId,
  offlineQueuePoLabel,
}: {
  purchaseOrderId: string;
  lines: Line[];
  finalizeMode?: "post" | "review";
  onRequestReview?: (items: { itemId: string; receivedQuantity: number }[]) => void;
  offlineQueueUserId?: string;
  offlineQueuePoLabel?: string;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmLargeOpen, setConfirmLargeOpen] = React.useState(false);
  const [largeReceiptLines, setLargeReceiptLines] = React.useState<PoConfirmLineHit[]>([]);
  const [pendingDraftItems, setPendingDraftItems] = React.useState<
    { itemId: string; receivedQuantity: number }[] | null
  >(null);

  const [qty, setQty] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((l) => {
        const remaining = Math.max(0, l.orderedQuantity - l.receivedQuantity);
        return [l.id, remaining > 0 ? String(remaining) : "0"];
      })
    )
  );

  function remainingFor(l: Line): number {
    return Math.max(0, l.orderedQuantity - l.receivedQuantity);
  }

  function fillRemaining() {
    setQty(
      Object.fromEntries(
        lines.map((l) => {
          const r = remainingFor(l);
          return [l.id, r > 0 ? String(r) : "0"];
        })
      )
    );
  }

  function clearQuantities() {
    setQty(Object.fromEntries(lines.map((l) => [l.id, "0"])));
  }

  function applyDraftItems(items: { itemId: string; receivedQuantity: number }[]) {
    setErr(null);
    if (finalizeMode === "review") {
      onRequestReview?.(items);
      return;
    }
    void postReceiveImmediate(items);
  }

  async function postReceiveImmediate(
    items: { itemId: string; receivedQuantity: number }[]
  ): Promise<void> {
    setErr(null);
    setOk(null);
    setSubmitting(true);
    const r = await submitPoReceiveWithOffline(
      offlineQueueUserId,
      { purchaseOrderId, items },
      offlineQueuePoLabel
    );
    setSubmitting(false);
    if (!r.success) {
      setErr(r.error ?? UserMessage.error.generic);
      return;
    }
    setOk(r.message ?? "Receipt completed.");
    router.refresh();
  }

  function maybeInterceptLargeReceipt(items: { itemId: string; receivedQuantity: number }[]) {
    const hits = findPoReceiveLinesNeedingConfirm(items, lines, PO_RECEIVE_CONFIRM_LINE_QTY_MIN);
    if (hits.length > 0) {
      setPendingDraftItems(items);
      setLargeReceiptLines(hits);
      setConfirmLargeOpen(true);
      return true;
    }
    applyDraftItems(items);
    return false;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines.map((l) => ({
      itemId: l.id,
      receivedQuantity: Number(qty[l.id] ?? 0) || 0,
    }));
    if (finalizeMode === "review") {
      if (!items.some((i) => i.receivedQuantity > 0)) {
        setErr("Enter at least one quantity greater than zero.");
        return;
      }
      setErr(null);
      maybeInterceptLargeReceipt(items);
      return;
    }
    if (maybeInterceptLargeReceipt(items)) return;
    await postReceiveImmediate(items);
  }

  async function receiveAllPending() {
    const items = lines.map((l) => ({
      itemId: l.id,
      receivedQuantity: remainingFor(l),
    }));
    if (!items.some((i) => i.receivedQuantity > 0)) return;
    if (maybeInterceptLargeReceipt(items)) return;
    await postReceiveImmediate(items);
  }

  const hasReceivable = lines.some((l) => l.receivedQuantity < l.orderedQuantity - 1e-9);
  const enteredPositiveQty = lines.some((l) => (Number(qty[l.id] ?? 0) || 0) > 0);

  function triggerPrimarySubmit() {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      {ok && (
        <Alert className="border-success/30 bg-success/8">
          <AlertDescription className="text-foreground">{ok}</AlertDescription>
        </Alert>
      )}
      <Alert className="border-primary/25 bg-muted/25">
        <Info className="text-primary mb-2 h-4 w-4 sm:float-left sm:mb-0 sm:mr-2" aria-hidden />
        <AlertDescription className="text-foreground leading-relaxed">
          <span className="font-medium">Dock checks:</span>
          <ul className="text-muted-foreground mt-1.5 list-inside list-disc space-y-0.5 text-xs sm:text-sm">
            <li>
              Open quantity is capped by what is still owed on each line — the server rejects
              overrun.
            </li>
            <li>
              Counts are audited as stock IN movements; double-check SKU and carton counts before
              posting.
            </li>
            <li>
              Any single line ≥ {PO_RECEIVE_CONFIRM_LINE_QTY_MIN.toLocaleString("nb-NO")} units
              prompts a confirmation (typo guard).
            </li>
          </ul>
        </AlertDescription>
      </Alert>
      <div className="border-border/60 flex flex-wrap items-center gap-2 border-b pb-3">
        <span className="text-muted-foreground mr-1 w-full text-xs sm:w-auto">Batch:</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 touch-manipulation px-3 text-xs sm:h-8 sm:min-h-0"
          disabled={submitting || !hasReceivable}
          onClick={() => fillRemaining()}
        >
          Fill remaining
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 touch-manipulation px-3 text-xs sm:h-8 sm:min-h-0"
          disabled={submitting}
          onClick={() => clearQuantities()}
        >
          Clear quantities
        </Button>
        {finalizeMode === "post" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 touch-manipulation px-3 text-xs sm:h-8 sm:min-h-0"
            disabled={submitting || !hasReceivable}
            onClick={() => void receiveAllPending()}
          >
            Post all pending lines
          </Button>
        ) : null}
      </div>
      <div className="space-y-3">
        {lines.map((l, idx) => {
          const remaining = remainingFor(l);
          const done = remaining < 1e-9;
          const isLast = idx === lines.length - 1;
          return (
            <div
              key={l.id}
              className="border-border/80 bg-muted/20 flex touch-manipulation flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end sm:justify-between sm:gap-2 sm:p-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{l.product.name}</div>
                <div className="text-muted-foreground font-mono text-xs">{l.product.sku}</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  Ordered {formatQuantityNbNo(l.orderedQuantity, l.product.unit.symbol)}{" "}
                  {l.product.unit.symbol} · Received{" "}
                  {formatQuantityNbNo(l.receivedQuantity, l.product.unit.symbol)}
                </div>
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-2 sm:flex-none">
                <Label htmlFor={`rcv-${l.id}`} className="sr-only">
                  Receive now
                </Label>
                <Input
                  id={`rcv-${l.id}`}
                  type="number"
                  min={0}
                  step="any"
                  disabled={done}
                  className="h-11 min-h-11 w-full min-w-[7rem] font-mono text-base sm:h-9 sm:min-h-0 sm:w-28 sm:text-sm"
                  value={qty[l.id] ?? ""}
                  onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isLast) {
                      if (finalizeMode === "post") {
                        if (!hasReceivable) return;
                        e.preventDefault();
                        triggerPrimarySubmit();
                        return;
                      }
                      if (enteredPositiveQty) {
                        e.preventDefault();
                        triggerPrimarySubmit();
                      }
                    }
                  }}
                />
                <span className="text-muted-foreground whitespace-nowrap text-xs">
                  max {formatQuantityNbNo(remaining, l.product.unit.symbol)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <AlertDialog
        open={confirmLargeOpen}
        onOpenChange={(open) => {
          setConfirmLargeOpen(open);
          if (!open) {
            setPendingDraftItems(null);
            setLargeReceiptLines([]);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm large quantities</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              You are posting a large receipt on at least one line (≥{" "}
              {PO_RECEIVE_CONFIRM_LINE_QTY_MIN.toLocaleString("nb-NO")} units). Please verify carton
              counts and SKU before continuing.
              <ul className="border-border bg-muted/20 text-foreground mt-3 max-h-48 list-inside list-disc space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                {largeReceiptLines.slice(0, 12).map((h) => (
                  <li key={h.sku}>
                    <span className="font-mono">{h.sku}</span> —{" "}
                    <span className="font-semibold">
                      {formatQuantityNbNo(h.receivedQuantity, h.unitSymbol)} {h.unitSymbol}
                    </span>
                    <span className="text-muted-foreground"> ({h.productName})</span>
                  </li>
                ))}
              </ul>
              {largeReceiptLines.length > 12 ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  +{largeReceiptLines.length - 12} more…
                </p>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const draft = pendingDraftItems;
                setConfirmLargeOpen(false);
                setLargeReceiptLines([]);
                setPendingDraftItems(null);
                if (draft) applyDraftItems(draft);
              }}
            >
              Looks correct — continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        type="submit"
        size="sm"
        className="min-h-11 w-full touch-manipulation sm:min-h-0 sm:w-auto"
        disabled={submitting || (finalizeMode === "post" ? !hasReceivable : !enteredPositiveQty)}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PackageOpen className="h-4 w-4" />
        )}
        <span className="ml-2">
          {finalizeMode === "review" ? "Continue to confirm" : "Post receiving"}
        </span>
      </Button>
    </form>
  );
}
