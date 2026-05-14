"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRightLeft, Printer } from "lucide-react";
import type { TransferSuggestion } from "@/lib/queries/manager-overview";
import { executeManagerSuggestedTransfer } from "@/lib/actions/manager-transfer";
import { UserMessage } from "@/lib/user-messages";
import { formatQuantityNbNo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

function openTransferPickListWindow(
  t: TransferSuggestion,
  qtyLine: string,
  noteLine: string
): void {
  const w = globalThis.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pick ${esc(t.sku)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 1.25rem; max-width: 40rem; }
    h1 { font-size: 1.1rem; margin: 0 0 0.5rem; }
    .muted { color: #555; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.35rem 0; border-bottom: 1px solid #ddd; font-size: 0.9rem; }
    @media print { body { padding: 0; } }
  </style></head><body>
  <h1>Internal transfer — pick list</h1>
  <p class="muted">Printed ${esc(new Date().toLocaleString("nb-NO"))}</p>
  <table>
    <tr><th>SKU</th><td>${esc(t.sku)}</td></tr>
    <tr><th>Product</th><td>${esc(t.productName)}</td></tr>
    <tr><th>From</th><td>${esc(t.fromLocationName)}</td></tr>
    <tr><th>To</th><td>${esc(t.toLocationName)}</td></tr>
    <tr><th>Qty</th><td>${esc(qtyLine)} ${esc(t.unitSymbol)}</td></tr>
    ${noteLine ? `<tr><th>Note</th><td>${esc(noteLine)}</td></tr>` : ""}
  </table>
  </body></html>`;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

function roundQty(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1000) / 1000;
}

export function ManagerTransferSuggestionsTable({
  transfers,
  canExecute = true,
}: {
  transfers: TransferSuggestion[];
  /** When false, hides execute controls (e.g. read-only preview). */
  canExecute?: boolean;
}) {
  if (transfers.length === 0) {
    return (
      <p className="text-muted-foreground px-6 py-8 text-center text-sm">
        No automatic transfer pairs match thresholds right now.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b text-left text-xs uppercase tracking-wide">
            <th className="px-4 py-2">SKU</th>
            <th className="px-4 py-2">From → To</th>
            <th className="px-4 py-2 text-right">On hand</th>
            <th className="px-4 py-2 text-right">Can move</th>
            <th className="px-4 py-2 text-right">To / min</th>
            <th className="w-[8rem] px-4 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {transfers.map((t) => (
            <TransferRow
              key={`${t.productId}-${t.fromLocationId}-${t.toLocationId}`}
              t={t}
              canExecute={canExecute}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransferRow({ t, canExecute }: { t: TransferSuggestion; canExecute: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [qty, setQty] = React.useState(() => String(roundQty(t.suggestedQty)));
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQty(String(roundQty(t.suggestedQty)));
      setNote("");
      setErr(null);
    }
  }

  const maxMove = roundQty(t.availableUnreserved);
  const canPost = canExecute && maxMove > 0;

  async function onConfirm() {
    setErr(null);
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setErr("Enter a positive quantity.");
      return;
    }
    if (q > maxMove + 1e-9) {
      setErr(
        `Quantity cannot exceed unreserved availability (${formatQuantityNbNo(maxMove, t.unitSymbol)}).`
      );
      return;
    }
    setPending(true);
    const r = await executeManagerSuggestedTransfer({
      productId: t.productId,
      fromLocationId: t.fromLocationId,
      toLocationId: t.toLocationId,
      quantity: q,
      note: note.trim() || undefined,
    });
    setPending(false);
    if (!r.success) {
      setErr(r.error ?? UserMessage.error.generic);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <tr>
      <td className="px-4 py-2 font-mono text-xs">
        <Link
          href={`/inventory/movements?product=${encodeURIComponent(t.productId)}`}
          className="text-primary hover:underline"
        >
          {t.sku}
        </Link>
      </td>
      <td className="px-4 py-2">
        <span className="font-medium">{t.fromLocationName}</span>
        <span className="text-muted-foreground"> → </span>
        <span className="font-medium">{t.toLocationName}</span>
        <div className="text-muted-foreground max-w-[220px] truncate text-xs">{t.productName}</div>
      </td>
      <td className="px-4 py-2 text-right font-mono">
        {formatQuantityNbNo(t.fromQty, t.unitSymbol)}
      </td>
      <td className="px-4 py-2 text-right font-mono">
        {formatQuantityNbNo(t.availableUnreserved, t.unitSymbol)}
      </td>
      <td className="px-4 py-2 text-right font-mono">
        {formatQuantityNbNo(t.toQty, t.unitSymbol)} /{" "}
        {formatQuantityNbNo(t.reorderPoint, t.unitSymbol)}
      </td>
      <td className="px-4 py-2 text-right">
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                disabled={!canPost}
                className="whitespace-nowrap"
              />
            }
          >
            <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
            Transfer
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" showCloseButton={true}>
            <DialogHeader>
              <DialogTitle>Confirm internal transfer</DialogTitle>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t.sku} · {t.productName}
                <br />
                <span className="text-foreground font-medium">
                  {t.fromLocationName} → {t.toLocationName}
                </span>
              </p>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              {err && (
                <Alert variant="destructive">
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor={`qty-${t.fromStockId}`}>Quantity ({t.unitSymbol})</Label>
                <Input
                  id={`qty-${t.fromStockId}`}
                  type="number"
                  min="0"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="font-mono"
                />
                <p className="text-muted-foreground text-xs">
                  Suggested {formatQuantityNbNo(roundQty(t.suggestedQty), t.unitSymbol)} · Max
                  (unreserved) {formatQuantityNbNo(maxMove, t.unitSymbol)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`note-${t.fromStockId}`}>Note (optional)</Label>
                <Textarea
                  id={`note-${t.fromStockId}`}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Van restock, urgent job…"
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter className="flex flex-wrap gap-2 border-t-0 bg-transparent p-0 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mr-auto sm:mr-0"
                onClick={() =>
                  openTransferPickListWindow(
                    t,
                    qty.trim() || String(roundQty(t.suggestedQty)),
                    note.trim()
                  )
                }
              >
                <Printer className="mr-1 h-3.5 w-3.5" />
                Print pick list
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={() => void onConfirm()}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Post transfer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}
