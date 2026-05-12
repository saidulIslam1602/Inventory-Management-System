import { z } from "zod";

export const managerSuggestedTransferSchema = z.object({
  productId: z.string().cuid(),
  fromLocationId: z.string().cuid(),
  toLocationId: z.string().cuid(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  note: z.string().max(500).optional(),
});

export type ManagerSuggestedTransferInput = z.infer<typeof managerSuggestedTransferSchema>;
