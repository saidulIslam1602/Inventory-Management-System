"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addPurchaseOrderEscalationNote } from "@/lib/actions/purchase-orders";
import { formatPurchaseOrderLineGapSummary } from "@/lib/manager-exception-escalation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PurchaseOrderEscalationNoteForm({
  purchaseOrderId,
  lines,
}: {
  purchaseOrderId: string;
  lines: Array<{
    orderedQuantity: unknown;
    receivedQuantity: unknown;
    product: { sku: string };
  }>;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [appendGaps, setAppendGaps] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const gapSummary = formatPurchaseOrderLineGapSummary(lines);

  const onSubmit = () => {
    setErr(null);
    const body =
      appendGaps && gapSummary
        ? [note.trim(), gapSummary].filter(Boolean).join("\n\n").trim()
        : note.trim();
    if (!body) {
      setErr("Enter text and/or append the line gap summary.");
      return;
    }
    startTransition(async () => {
      const r = await addPurchaseOrderEscalationNote({ purchaseOrderId, note: body });
      if (r.success) {
        setNote("");
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Escalation / discrepancy note</CardTitle>
        <CardDescription>
          Logs an append-only entry on the activity log below — supplier issues, short receipts, or
          internal follow-up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="po-esc-note">Note</Label>
          <Textarea
            id="po-esc-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={pending}
            placeholder="e.g. Supplier confirmed partial shipment; chase remainder Monday."
          />
        </div>
        {gapSummary ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={appendGaps}
              onChange={(e) => setAppendGaps(e.target.checked)}
              disabled={pending}
            />
            <span className="text-muted-foreground">
              Append current line gap summary ({gapSummary.slice(0, 120)}
              {gapSummary.length > 120 ? "…" : ""})
            </span>
          </label>
        ) : null}
        {err ? <p className="text-destructive text-sm">{err}</p> : null}
        <Button type="button" size="sm" onClick={onSubmit} disabled={pending}>
          {pending ? "Saving…" : "Log note on PO audit trail"}
        </Button>
      </CardContent>
    </Card>
  );
}
