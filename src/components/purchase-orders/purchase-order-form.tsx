"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { purchaseOrderSchema, type PurchaseOrderInput } from "@/lib/validations/purchase-order";
import { createPurchaseOrder } from "@/lib/actions/purchase-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface PurchaseOrderFormProps {
  suppliers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  products: { id: string; name: string; sku: string; unitPrice: number }[];
  className?: string;
}

export function PurchaseOrderForm({
  suppliers,
  locations,
  products,
  className,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderInput>({
    resolver: zodResolver(purchaseOrderSchema) as Resolver<PurchaseOrderInput>,
    defaultValues: {
      supplierId: suppliers[0]?.id ?? "",
      locationId: locations[0]?.id ?? "",
      notes: "",
      items: [
        {
          productId: products[0]?.id ?? "",
          orderedQuantity: 1,
          unitPrice: products[0]?.unitPrice ?? 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  async function onSubmit(data: PurchaseOrderInput) {
    setServerError(null);
    const result = await createPurchaseOrder(data);
    if (!result.success) {
      setServerError(result.error ?? "Could not create purchase order.");
      return;
    }
    router.push("/purchase-orders");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn("max-w-4xl space-y-8", className)}>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="supplierId">Supplier</Label>
          <NativeSelect
            id="supplierId"
            className="w-full"
            {...register("supplierId")}
            aria-invalid={!!errors.supplierId}
          >
            {suppliers.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.supplierId && (
            <p className="text-destructive text-xs">{errors.supplierId.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="locationId">Deliver to location</Label>
          <NativeSelect
            id="locationId"
            className="w-full"
            {...register("locationId")}
            aria-invalid={!!errors.locationId}
          >
            {locations.map((l) => (
              <NativeSelectOption key={l.id} value={l.id}>
                {l.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.locationId && (
            <p className="text-destructive text-xs">{errors.locationId.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expectedDate">Expected date (optional)</Label>
          <Input id="expectedDate" type="date" {...register("expectedDate")} />
          {errors.expectedDate && (
            <p className="text-destructive text-xs">{String(errors.expectedDate.message)}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            rows={2}
            {...register("notes")}
            placeholder="Reference, contact, instructions…"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-base">Line items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                productId: products[0]?.id ?? "",
                orderedQuantity: 1,
                unitPrice: products[0]?.unitPrice ?? 0,
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Add line
          </Button>
        </div>
        {errors.items && typeof errors.items.message === "string" && (
          <p className="text-destructive text-xs">{errors.items.message}</p>
        )}

        <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {fields.map((field, index) => (
            <div key={field.id} className="bg-card grid items-end gap-4 p-4 sm:grid-cols-12">
              <div className="space-y-2 sm:col-span-5">
                <Label className="text-muted-foreground text-xs">Product</Label>
                <NativeSelect className="w-full" {...register(`items.${index}.productId` as const)}>
                  {products.map((p) => (
                    <NativeSelectOption key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.items?.[index]?.productId && (
                  <p className="text-destructive text-xs">
                    {errors.items[index]?.productId?.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label className="text-muted-foreground text-xs">Qty</Label>
                <Input
                  type="number"
                  step="0.001"
                  min={0.001}
                  {...register(`items.${index}.orderedQuantity` as const)}
                />
                {errors.items?.[index]?.orderedQuantity && (
                  <p className="text-destructive text-xs">
                    {errors.items[index]?.orderedQuantity?.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label className="text-muted-foreground text-xs">Enhetspris (NOK, eks. mva)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  {...register(`items.${index}.unitPrice` as const)}
                />
                {errors.items?.[index]?.unitPrice && (
                  <p className="text-destructive text-xs">
                    {errors.items[index]?.unitPrice?.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end pb-1 sm:col-span-1">
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove line</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            "Create purchase order"
          )}
        </Button>
      </div>
    </form>
  );
}
