"use client";

/**
 * Guided PO receipt: Step 1 — pick order (navigation); Step 2 — quantities; Step 3 — confirm post.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, PackageSearch } from "lucide-react";
import {
  PurchaseOrderReceiveForm,
  type PurchaseOrderReceiveLinePayload,
} from "@/components/manager/purchase-order-receive-form";
import { submitPoReceiveWithOffline } from "@/lib/receive-offline-submit";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatQuantityNbNo, cn } from "@/lib/utils";

export type ReceiveWizardCandidate = {
  id: string;
  poNumber: string;
  status: string;
  supplierName: string;
  locationName: string;
};

export type ReceiveWizardPoDetail = {
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  locationName: string;
  lines: PurchaseOrderReceiveLinePayload[];
};

function StepIndicator({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const steps = ["Choose PO", "Line quantities", "Confirm receipt"] as const;
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = n === activeStep;
        const done = n < activeStep;
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              active &&
                "border-primary bg-primary/10 text-foreground ring-primary/25 ring-offset-background ring-1 ring-offset-1",
              done && "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
              !active && !done && "text-muted-foreground border-dashed"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                active && "bg-primary text-primary-foreground",
                done && "bg-muted-foreground/30",
                !active && !done && "bg-muted"
              )}
            >
              {done ? "✓" : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function ReceiveWizardReceivingPane({
  detail,
  offlineQueueUserId,
}: {
  detail: ReceiveWizardPoDetail;
  offlineQueueUserId?: string;
}) {
  const router = useRouter();
  const receivableLines = detail.lines.filter((l) => l.receivedQuantity < l.orderedQuantity - 1e-9);
  const [reviewItems, setReviewItems] = React.useState<
    { itemId: string; receivedQuantity: number }[] | null
  >(null);
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const [confirmErr, setConfirmErr] = React.useState<string | null>(null);

  const activeStep: 2 | 3 = reviewItems === null ? 2 : 3;

  const lineById = React.useMemo(() => new Map(detail.lines.map((l) => [l.id, l])), [detail.lines]);

  async function onConfirmReceipt() {
    if (!reviewItems) return;
    setConfirmErr(null);
    setConfirmBusy(true);
    const r = await submitPoReceiveWithOffline(
      offlineQueueUserId,
      { purchaseOrderId: detail.purchaseOrderId, items: reviewItems },
      detail.poNumber
    );
    setConfirmBusy(false);
    if (!r.success) {
      setConfirmErr(r.error ?? UserMessage.error.generic);
      return;
    }
    router.replace("/inventory/receive");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <StepIndicator activeStep={activeStep} />

      {receivableLines.length === 0 && (
        <Alert>
          <AlertDescription>
            This order has no remaining lines to receive.{" "}
            <Link
              href="/inventory/receive"
              className="text-primary font-medium underline-offset-2 hover:underline"
            >
              Choose another PO
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {receivableLines.length > 0 && reviewItems === null && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                <span className="font-mono">{detail.poNumber}</span>
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {detail.supplierName} → {detail.locationName}
                </span>
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="min-h-9">
              <Link href="/inventory/receive">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Change PO
              </Link>
            </Button>
          </div>
          <PurchaseOrderReceiveForm
            purchaseOrderId={detail.purchaseOrderId}
            lines={receivableLines}
            finalizeMode="review"
            offlineQueueUserId={offlineQueueUserId}
            offlineQueuePoLabel={detail.poNumber}
            onRequestReview={(items) => setReviewItems(items)}
          />
        </div>
      )}

      {reviewItems !== null && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Confirm receipt for <span className="font-mono">{detail.poNumber}</span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9"
              disabled={confirmBusy}
              onClick={() => setReviewItems(null)}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Back to quantities
            </Button>
          </div>

          {confirmErr ? (
            <Alert variant="destructive">
              <AlertDescription>{confirmErr}</AlertDescription>
            </Alert>
          ) : null}

          <div className="border-border overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b text-left text-xs uppercase tracking-wide">
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5">Receiving now</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reviewItems
                  .filter((i) => i.receivedQuantity > 0)
                  .map((i) => {
                    const line = lineById.get(i.itemId);
                    if (!line) return null;
                    return (
                      <tr key={i.itemId}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{line.product.name}</div>
                          <div className="text-muted-foreground font-mono text-xs">
                            {line.product.sku}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {formatQuantityNbNo(i.receivedQuantity, line.product.unit.symbol)}{" "}
                          {line.product.unit.symbol}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <p className="text-muted-foreground text-xs">
            Posting writes IN movements at{" "}
            <span className="text-foreground font-medium">{detail.locationName}</span> and updates
            PO line received quantities — same outcome as confirming on the purchase order detail
            page.
          </p>

          <Button
            type="button"
            size="lg"
            className="min-h-11 w-full touch-manipulation sm:w-auto"
            disabled={confirmBusy}
            onClick={() => void onConfirmReceipt()}
          >
            {confirmBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span className="ml-2">Confirm receipt</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export function ReceivePurchaseOrderWizard({
  candidates,
  detail,
  wizardErrorMessage,
  offlineQueueUserId,
}: {
  candidates: ReceiveWizardCandidate[];
  detail: ReceiveWizardPoDetail | null;
  wizardErrorMessage?: string | null;
  offlineQueueUserId?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">Receive against purchase order</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Step through choosing an open PO, entering quantities at the dock, then confirming Stock
            IN movements against that order — same ledger rules as posting from the PO detail page.
          </p>
        </div>
        <PackageSearch
          className="text-muted-foreground hidden h-8 w-8 shrink-0 sm:block"
          aria-hidden
        />
      </div>

      {wizardErrorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{wizardErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {!detail ? (
        <>
          <StepIndicator activeStep={1} />
          <div className="space-y-3">
            {candidates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No purchase orders are waiting for receipt
                <span className="text-muted-foreground/85">
                  {" "}
                  (status ORDERED or PARTIALLY_RECEIVED)
                </span>
                .
              </p>
            ) : (
              <ul className="divide-border border-border divide-y overflow-hidden rounded-lg border">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/inventory/receive?po=${encodeURIComponent(c.id)}`}
                      className="hover:bg-muted/35 flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span>
                        <span className="text-primary font-mono font-semibold">{c.poNumber}</span>
                        <span className="text-muted-foreground ml-2 text-sm">{c.supplierName}</span>
                        <span className="text-muted-foreground block text-xs sm:ml-0 sm:mt-0.5 sm:inline">
                          {" "}
                          → {c.locationName}
                        </span>
                      </span>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <ReceiveWizardReceivingPane
          key={detail.purchaseOrderId}
          detail={detail}
          offlineQueueUserId={offlineQueueUserId}
        />
      )}
    </div>
  );
}
