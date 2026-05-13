"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { addPurchaseOrderEscalationNote } from "@/lib/actions/purchase-orders";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ManagerExceptionEscalateButton({
  purchaseOrderId,
  prefill,
  readOnly = false,
}: {
  purchaseOrderId: string;
  /** Context from the exception row — editable before submit */
  prefill: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState(prefill);
  const [err, setErr] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setNote(prefill);
      setErr(null);
    }
  };

  if (readOnly) return null;

  const onSubmit = () => {
    setErr(null);
    startTransition(async () => {
      const r = await addPurchaseOrderEscalationNote({ purchaseOrderId, note });
      if (r.success) {
        handleOpenChange(false);
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpenChange(true);
        }}
      >
        <MessageSquarePlus className="mr-1.5 h-4 w-4" />
        Log note
      </Button>
      <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Escalation / follow-up note</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-xs">
          Saved to this PO&apos;s activity log (append-only audit). Refine the text below if needed.
        </p>
        <div className="space-y-2">
          <Label htmlFor="mgr-ex-note">Note</Label>
          <Textarea
            id="mgr-ex-note"
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={pending}
            className="min-h-[120px] resize-y"
          />
        </div>
        {err ? <p className="text-destructive text-sm">{err}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={pending || !note.trim()}>
            {pending ? "Saving…" : "Save to PO log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
