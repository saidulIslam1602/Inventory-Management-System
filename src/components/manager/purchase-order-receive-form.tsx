"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageOpen } from "lucide-react";
import { receiveItems } from "@/lib/actions/purchase-orders";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatQuantityNbNo } from "@/lib/utils";

type Line = {
  id: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
  product: { name: string; sku: string; unit: { symbol: string } };
};

export function PurchaseOrderReceiveForm({
  purchaseOrderId,
  lines,
}: {
  purchaseOrderId: string;
  lines: Line[];
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
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

  async function postReceive(items: { itemId: string; receivedQuantity: number }[]): Promise<void> {
    setErr(null);
    setOk(null);
    setSubmitting(true);
    const r = await receiveItems({ purchaseOrderId, items });
    setSubmitting(false);
    if (!r.success) {
      setErr(r.error ?? UserMessage.error.generic);
      return;
    }
    setOk(r.message ?? "Receipt completed.");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines.map((l) => ({
      itemId: l.id,
      receivedQuantity: Number(qty[l.id] ?? 0) || 0,
    }));
    await postReceive(items);
  }

  async function receiveAllPending() {
    const items = lines.map((l) => ({
      itemId: l.id,
      receivedQuantity: remainingFor(l),
    }));
    if (!items.some((i) => i.receivedQuantity > 0)) return;
    await postReceive(items);
  }

  const hasReceivable = lines.some((l) => l.receivedQuantity < l.orderedQuantity - 1e-9);

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
                    if (e.key === "Enter" && isLast && hasReceivable) {
                      e.preventDefault();
                      formRef.current?.requestSubmit();
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
      <Button
        type="submit"
        size="sm"
        className="min-h-11 w-full touch-manipulation sm:min-h-0 sm:w-auto"
        disabled={submitting || !hasReceivable}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PackageOpen className="h-4 w-4" />
        )}
        <span className="ml-2">Post receiving</span>
      </Button>
    </form>
  );
}
