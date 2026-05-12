"use client";

/**
 * Goods-in screen: barcode/SKU field works with USB keyboard-wedge scanners (types code + Enter).
 * Pre-fills unit cost from product.purchaseUnitCost when set.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, ScanBarcode } from "lucide-react";
import {
  receiveIncomingGoods,
  previewProductByScanCode,
  type ProductScanPreview,
} from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ReceiveGoodsFormProps {
  locations: { id: string; name: string }[];
  className?: string;
}

export function ReceiveGoodsForm({ locations, className }: ReceiveGoodsFormProps) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<ProductScanPreview | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

    startTransition(async () => {
      const result = await receiveIncomingGoods({
        locationId,
        code: code.trim(),
        quantity: qty,
        unitCost: costParsed !== undefined && Number.isFinite(costParsed) ? costParsed : undefined,
        note: note.trim() || undefined,
      });

      if (!result.success) {
        setServerError(result.error ?? "Failed to save");
        return;
      }

      resetForNextScan(result.message ?? "Recorded");
    });
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
          <Input
            id="recv-code"
            name="code"
            autoComplete="off"
            spellCheck={false}
            placeholder="Focus here — scanner types into this field"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono"
            disabled={isPending}
          />
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
    </form>
  );
}
