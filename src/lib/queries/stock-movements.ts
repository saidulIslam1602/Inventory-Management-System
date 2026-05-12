/**
 * Shared stock movement list filters (pages + CSV export).
 */

import { MovementType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { osloYmdRangeToUtcBounds } from "@/lib/business-calendar";

export const MOVEMENT_TYPES = Object.values(MovementType);

export function buildStockMovementWhere(params: {
  type?: MovementType;
  locationId?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
}): Prisma.StockMovementWhereInput {
  const where: Prisma.StockMovementWhereInput = {};

  if (params.type) where.type = params.type;

  const stockFilter: Prisma.StockWhereInput = {};
  if (params.locationId) stockFilter.locationId = params.locationId;
  if (params.q) {
    stockFilter.product = {
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { sku: { contains: params.q, mode: "insensitive" } },
        { barcode: { contains: params.q, mode: "insensitive" } },
      ],
    };
  }
  if (Object.keys(stockFilter).length > 0) where.stock = stockFilter;

  const bounds = osloYmdRangeToUtcBounds(params.dateFrom, params.dateTo);
  if (bounds.gte || bounds.lte) {
    where.createdAt = {};
    if (bounds.gte) where.createdAt.gte = bounds.gte;
    if (bounds.lte) where.createdAt.lte = bounds.lte;
  }

  return where;
}

export const stockMovementListInclude = {
  stock: {
    include: {
      product: { select: { name: true, sku: true, unit: { select: { symbol: true } } } },
      location: { select: { name: true } },
    },
  },
  user: { select: { name: true } },
  fromLocation: { select: { name: true } },
  toLocation: { select: { name: true } },
} as const satisfies Prisma.StockMovementInclude;

export type StockMovementListRow = Prisma.StockMovementGetPayload<{
  include: typeof stockMovementListInclude;
}>;
