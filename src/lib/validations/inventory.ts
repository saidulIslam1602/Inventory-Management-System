import { z } from "zod";
import { MovementType } from "@prisma/client";

export const productSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(50),
  barcode: z
    .string()
    .max(64)
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s.trim() : undefined)),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  unitPrice: z.coerce.number().min(0, "Price must be non-negative"),
  purchaseUnitCost: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  categoryId: z.string().cuid("Invalid category"),
  unitId: z.string().cuid("Invalid unit"),
  supplierId: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() !== "" ? s : undefined))
    .pipe(z.union([z.undefined(), z.string().cuid("Invalid supplier")])),
  imageUrl: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productSchema>;

export const stockMovementSchema = z.object({
  stockId: z.string().cuid(),
  type: z.nativeEnum(MovementType),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unitCost: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  note: z.string().optional(),
  fromLocationId: z.string().cuid().optional(),
  toLocationId: z.string().cuid().optional(),
  purchaseOrderId: z.string().cuid().optional(),
  projectId: z.string().cuid().optional(),
});

export const receiveIncomingSchema = z.object({
  locationId: z.string().cuid("Invalid location"),
  code: z
    .string()
    .min(1, "Scan or type barcode / SKU")
    .transform((s) => s.trim()),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unitCost: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  note: z.string().optional(),
});

export type ReceiveIncomingInput = z.infer<typeof receiveIncomingSchema>;

export type StockMovementInput = z.infer<typeof stockMovementSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
