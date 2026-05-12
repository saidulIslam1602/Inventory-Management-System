import { z } from "zod";

export const purchaseOrderSchema = z.object({
  supplierId: z.string().cuid("Invalid supplier"),
  locationId: z.string().cuid("Invalid location"),
  expectedDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().cuid("Invalid product"),
        orderedQuantity: z.coerce.number().positive("Quantity must be greater than 0"),
        unitPrice: z.coerce.number().min(0, "Price must be non-negative"),
      })
    )
    .min(1, "At least one item is required"),
});

export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

export const receiveItemsSchema = z.object({
  purchaseOrderId: z.string().cuid(),
  items: z.array(
    z.object({
      itemId: z.string().cuid(),
      receivedQuantity: z.coerce.number().min(0),
    })
  ),
});

export type ReceiveItemsInput = z.infer<typeof receiveItemsSchema>;
