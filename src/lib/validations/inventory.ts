import { z } from "zod";
import { MovementType } from "@prisma/client";

export const productSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  unitPrice: z.coerce.number().min(0, "Price must be non-negative"),
  categoryId: z.string().cuid("Invalid category"),
  unitId: z.string().cuid("Invalid unit"),
  supplierId: z.string().cuid("Invalid supplier").optional(),
  imageUrl: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productSchema>;

export const stockMovementSchema = z.object({
  stockId: z.string().cuid(),
  type: z.nativeEnum(MovementType),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  note: z.string().optional(),
  fromLocationId: z.string().cuid().optional(),
  toLocationId: z.string().cuid().optional(),
  purchaseOrderId: z.string().cuid().optional(),
  projectId: z.string().cuid().optional(),
});

export type StockMovementInput = z.infer<typeof stockMovementSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
