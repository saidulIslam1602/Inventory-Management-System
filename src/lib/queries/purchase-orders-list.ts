import { POStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const PO_STATUSES = Object.values(POStatus);

export function buildPurchaseOrderWhere(params: {
  status?: POStatus;
  supplierId?: string;
  locationId?: string;
  q?: string;
}): Prisma.PurchaseOrderWhereInput {
  const where: Prisma.PurchaseOrderWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.supplierId) where.supplierId = params.supplierId;
  if (params.locationId) where.locationId = params.locationId;
  if (params.q) {
    where.OR = [
      { poNumber: { contains: params.q, mode: "insensitive" } },
      { supplier: { name: { contains: params.q, mode: "insensitive" } } },
      { notes: { contains: params.q, mode: "insensitive" } },
    ];
  }
  return where;
}
