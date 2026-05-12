"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { productSchema, type ProductInput } from "@/lib/validations/inventory";
import { createProduct, updateProduct } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export interface ProductFormProduct {
  id: string;
  sku: string;
  barcode?: string | null;
  purchaseUnitCost?: number | string | { toString: () => string } | null;
  name: string;
  description: string | null;
  unitPrice: number | string | { toString: () => string };
  categoryId: string;
  unitId: string;
  supplierId: string | null;
  imageUrl: string | null;
}

interface ProductFormProps {
  categories: { id: string; name: string }[];
  units: { id: string; name: string; symbol: string }[];
  suppliers: { id: string; name: string }[];
  product?: ProductFormProduct;
  className?: string;
}

export function ProductForm({
  categories,
  units,
  suppliers,
  product,
  className,
}: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema) as Resolver<ProductInput>,
    defaultValues: product
      ? {
          sku: product.sku,
          barcode: product.barcode ?? "",
          name: product.name,
          description: product.description ?? "",
          unitPrice: Number(product.unitPrice),
          purchaseUnitCost:
            product.purchaseUnitCost !== undefined && product.purchaseUnitCost !== null
              ? Number(product.purchaseUnitCost)
              : undefined,
          categoryId: product.categoryId,
          unitId: product.unitId,
          supplierId: product.supplierId ?? "",
          imageUrl: product.imageUrl ?? "",
        }
      : {
          sku: "",
          barcode: "",
          name: "",
          description: "",
          unitPrice: 0,
          purchaseUnitCost: undefined,
          categoryId: categories[0]?.id ?? "",
          unitId: units[0]?.id ?? "",
          supplierId: "",
          imageUrl: "",
        },
  });

  async function onSubmit(data: ProductInput) {
    setServerError(null);
    const result = isEdit ? await updateProduct(product!.id, data) : await createProduct(data);

    if (!result.success) {
      setServerError(result.error ?? "Something went wrong.");
      return;
    }
    router.push("/inventory");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn("max-w-2xl space-y-6", className)}>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>Please correct the highlighted fields.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            {...register("sku")}
            aria-invalid={!!errors.sku}
            className="font-mono text-sm"
          />
          {errors.sku && <p className="text-destructive text-xs">{errors.sku.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="barcode">Barcode (optional)</Label>
          <Input
            id="barcode"
            {...register("barcode")}
            aria-invalid={!!errors.barcode}
            className="font-mono text-sm"
            placeholder="EAN / internal code for scanner"
            autoComplete="off"
          />
          {errors.barcode && <p className="text-destructive text-xs">{errors.barcode.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="unitPrice">Enhetspris (NOK, eks. mva)</Label>
          <Input
            id="unitPrice"
            type="number"
            step="0.01"
            min={0}
            {...register("unitPrice")}
            aria-invalid={!!errors.unitPrice}
          />
          {errors.unitPrice && (
            <p className="text-destructive text-xs">{errors.unitPrice.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchaseUnitCost">Standard innkjøpskost (NOK / enhet, valgfri)</Label>
          <Input
            id="purchaseUnitCost"
            type="number"
            step="0.01"
            min={0}
            {...register("purchaseUnitCost")}
            aria-invalid={!!errors.purchaseUnitCost}
            placeholder="Forhåndsutfylles ved mottak"
          />
          {errors.purchaseUnitCost && (
            <p className="text-destructive text-xs">{errors.purchaseUnitCost.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Product name</Label>
        <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="categoryId">Category</Label>
          <NativeSelect
            id="categoryId"
            className="w-full"
            {...register("categoryId")}
            aria-invalid={!!errors.categoryId}
          >
            {categories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.categoryId && (
            <p className="text-destructive text-xs">{errors.categoryId.message}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="unitId">Måleenhet</Label>
          <NativeSelect
            id="unitId"
            className="w-full"
            {...register("unitId")}
            aria-invalid={!!errors.unitId}
          >
            {units.map((u) => (
              <NativeSelectOption key={u.id} value={u.id}>
                {u.symbol} — {u.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.unitId && <p className="text-destructive text-xs">{errors.unitId.message}</p>}
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="supplierId">Supplier (optional)</Label>
          <NativeSelect id="supplierId" className="w-full" {...register("supplierId")}>
            <NativeSelectOption value="">— None —</NativeSelectOption>
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="imageUrl">Image URL (optional)</Label>
        <Input
          id="imageUrl"
          type="url"
          placeholder="https://…"
          {...register("imageUrl")}
          aria-invalid={!!errors.imageUrl}
        />
        {errors.imageUrl && <p className="text-destructive text-xs">{errors.imageUrl.message}</p>}
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
              Saving…
            </>
          ) : isEdit ? (
            "Save changes"
          ) : (
            "Create product"
          )}
        </Button>
      </div>
    </form>
  );
}
