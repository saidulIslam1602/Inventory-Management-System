"use client";

/**
 * Goods-in screen: barcode/SKU field works with USB keyboard-wedge scanners (types code + Enter).
 * Pre-fills unit cost from product.purchaseUnitCost when set.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { Camera, Loader2, ScanBarcode, Info } from "lucide-react";
import { previewProductByScanCode, type ProductScanPreview } from "@/lib/actions/inventory";
import { submitQuickReceiveWithOffline } from "@/lib/receive-offline-submit";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
import { cn } from "@/lib/utils";
import {
  QUICK_RECEIVE_CONFIRM_QTY_MIN,
  quickReceiveQuantityNeedsConfirm,
} from "@/lib/receive-confirm-rules";
import {
  BarcodeCameraScanDialog,
  inlineCameraBarcodeScanAvailable,
} from "@/components/inventory/barcode-camera-scan-dialog";

function useInlineCameraScanEligible(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      setOk(inlineCameraBarcodeScanAvailable());
    });
  }, []);
  return ok;
}

interface ReceiveGoodsFormProps {
  locations: { id: string; name: string }[];
  /** When set (signed-in user id), offline / flaky network queues quick receives on this browser. */
  offlineQueueUserId?: string;
  className?: string;
}

export function ReceiveGoodsForm({
  locations,
  offlineQueueUserId,
  className,
}: ReceiveGoodsFormProps) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<ProductScanPreview | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [largeQtyOpen, setLargeQtyOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{
    locationId: string;
    code: string;
    quantity: number;
    unitCost?: number;
    note?: string;
  } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraEligible = useInlineCameraScanEligible();

  const runPreview = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setPreview(null);
      return;
    }
    const p = await previewProductByScanCode(trimmed);
    setPreview(p);
    if (p?.purchaseUnitCost != null) {
      setUnitCost((prev) => (prev.trim() === "" ? String(p.purchaseUnitCost) : prev));
    }
  }, []);

  useEffect(() => {
    const el = document.getElementById("recv-code") as HTMLInputElement | null;
    el?.focus();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runPreview(code);
    }, 200);
    return () => window.clearTimeout(t);
  }, [code, runPreview]);

  function resetForNextScan(message?: string) {
    if (message) setSuccess(message);
    setCode("");
    setPreview(null);
    setQuantity("1");
    setUnitCost("");
    setNote("");
    window.setTimeout(() => {
      const el = document.getElementById("recv-code") as HTMLInputElement | null;
      el?.focus();
    }, 50);
  }

  function runReceipt(payload: {
    locationId: string;
    code: string;
    quantity: number;
    unitCost?: number;
    note?: string;
  }) {
    startTransition(async () => {
      try {
        const result = await submitQuickReceiveWithOffline(offlineQueueUserId, payload);
        if (!result.success) {
          setServerError(result.error ?? UserMessage.error.generic);
          return;
        }
        resetForNextScan(result.message ?? "Receipt recorded.");
      } catch {
        setServerError(UserMessage.error.generic);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccess(null);

    const qty = Number.parseFloat(quantity.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setServerError("Enter a valid quantity.");
      return;
    }

    const costRaw = unitCost.trim();
    const costParsed = costRaw === "" ? undefined : Number.parseFloat(costRaw.replace(",", "."));

    const payload = {
      locationId,
      code: code.trim(),
      quantity: qty,
      unitCost: costParsed !== undefined && Number.isFinite(costParsed) ? costParsed : undefined,
      note: note.trim() || undefined,
    };

    if (quickReceiveQuantityNeedsConfirm(qty)) {
      setPendingPayload(payload);
      setLargeQtyOpen(true);
      return;
    }
    runReceipt(payload);
  }

  if (locations.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No active locations — add a location before receiving stock.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("max-w-xl space-y-6", className)}>
      <div className="border-border bg-muted/20 space-y-4 rounded-lg border p-4">
        <div className="text-foreground flex items-center gap-2 text-sm font-medium">
          <ScanBarcode className="text-primary h-4 w-4" />
          Scan barcode or type SKU, then press Enter or Save
        </div>

        <Alert className="border-primary/25 bg-muted/25 py-3">
          <Info className="text-primary mb-2 h-4 w-4 sm:float-left sm:mb-0 sm:mr-2" aria-hidden />
          <AlertDescription className="text-foreground leading-relaxed">
            <span className="font-medium">Quick receive</span> does not link to a PO — use{" "}
            <span className="font-medium">Guided PO receive</span> above when matching a shipment.
            Quantities ≥ {QUICK_RECEIVE_CONFIRM_QTY_MIN.toLocaleString("nb-NO")} require a
            confirmation tap to prevent scanner double-enters.{" "}
            <span className="text-muted-foreground">
              Tap <span className="text-foreground font-medium">Use camera</span> to scan labels
              with the device camera (HTTPS / localhost).
            </span>
          </AlertDescription>
        </Alert>

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-primary/30 bg-primary/5 text-foreground">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="recv-location">Receiving location</Label>
          <NativeSelect
            id="recv-location"
            className="w-full"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <NativeSelectOption key={l.id} value={l.id}>
                {l.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recv-code">Barcode / SKU</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Input
              id="recv-code"
              name="code"
              autoComplete="off"
              spellCheck={false}
              placeholder="Focus here — scanner types into this field"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-11 flex-1 font-mono sm:min-h-9"
              disabled={isPending}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isPending || !cameraEligible}
              title={
                cameraEligible
                  ? "Scan a barcode using the camera"
                  : "Camera scan needs HTTPS (or localhost) and permission support."
              }
              className="min-h-11 w-full shrink-0 touch-manipulation sm:mt-px sm:h-11 sm:min-h-0 sm:w-auto"
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="mr-2 h-4 w-4" aria-hidden />
              Use camera
            </Button>
          </div>
          {preview && (
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{preview.name}</span>
              <span className="mx-1">·</span>
              {preview.sku}
              {preview.barcode ? (
                <>
                  <span className="mx-1">·</span>
                  <span className="font-mono text-xs">{preview.barcode}</span>
                </>
              ) : null}
            </p>
          )}
          {code.trim() && !preview && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No matching active product for this code.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recv-qty">Quantity</Label>
            <Input
              id="recv-qty"
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recv-cost">Unit cost (NOK, optional)</Label>
            <Input
              id="recv-cost"
              type="text"
              inputMode="decimal"
              placeholder="From product default if set"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              disabled={isPending}
            />
            <p className="text-muted-foreground text-xs">
              Saved on this movement and updates the product default purchase cost when you enter a
              value.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recv-note">Note (optional)</Label>
          <Input
            id="recv-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Delivery ref., supplier, etc."
            disabled={isPending}
          />
        </div>

        <Button type="submit" disabled={isPending || !code.trim()}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Record goods in"
          )}
        </Button>
      </div>

      <AlertDialog
        open={largeQtyOpen}
        onOpenChange={(open) => {
          setLargeQtyOpen(open);
          if (!open) setPendingPayload(null);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm large quantity</AlertDialogTitle>
            <AlertDialogDescription>
              You are recording{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {pendingPayload != null ? pendingPayload.quantity.toLocaleString("nb-NO") : "—"}
              </span>{" "}
              units in one quick receipt (threshold{" "}
              {QUICK_RECEIVE_CONFIRM_QTY_MIN.toLocaleString("nb-NO")}
              ). Is the quantity correct?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingPayload || isPending}
              onClick={() => {
                const p = pendingPayload;
                setLargeQtyOpen(false);
                setPendingPayload(null);
                if (p) runReceipt(p);
              }}
            >
              Yes, record goods in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BarcodeCameraScanDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDecoded={(raw) => {
          setServerError(null);
          setSuccess(null);
          setCode(raw);
          window.requestAnimationFrame(() => {
            (document.getElementById("recv-qty") as HTMLInputElement | null)?.focus();
          });
        }}
      />
    </form>
  );
}
