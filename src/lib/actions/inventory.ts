"use server";

/**
 * Inventory Server Actions.
 *
 * All mutations run server-side, validated with Zod before touching the DB.
 * Stock movements are always appended (never deleted) — immutable audit trail.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  productSchema,
  receiveIncomingSchema,
  stockMovementSchema,
} from "@/lib/validations/inventory";
import type { ActionResult } from "@/types";
import type { Product } from "@prisma/client";

// ── Create Product ────────────────────────────────────────────────────────────

export async function createProduct(formData: unknown): Promise<ActionResult<Product>> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = productSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    // Check SKU uniqueness
    const existing = await prisma.product.findUnique({ where: { sku: parsed.data.sku } });
    if (existing) return { success: false, error: "A product with this SKU already exists" };

    if (parsed.data.barcode) {
      const barcodeTaken = await prisma.product.findUnique({
        where: { barcode: parsed.data.barcode },
      });
      if (barcodeTaken)
        return { success: false, error: "This barcode is already registered on another product" };
    }

    const product = await prisma.product.create({
      data: {
        sku: parsed.data.sku,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        unitPrice: parsed.data.unitPrice,
        categoryId: parsed.data.categoryId,
        unitId: parsed.data.unitId,
        barcode: parsed.data.barcode ?? null,
        purchaseUnitCost: parsed.data.purchaseUnitCost ?? null,
        supplierId: parsed.data.supplierId || null,
        imageUrl: parsed.data.imageUrl || null,
      },
    });

    revalidatePath("/inventory");
    return { success: true, data: product, message: "Product created successfully" };
  } catch {
    return { success: false, error: "Failed to create product" };
  }
}

// ── Update Product ────────────────────────────────────────────────────────────

export async function updateProduct(id: string, formData: unknown): Promise<ActionResult<Product>> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = productSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    if (parsed.data.barcode) {
      const barcodeTaken = await prisma.product.findFirst({
        where: { barcode: parsed.data.barcode, NOT: { id } },
      });
      if (barcodeTaken)
        return { success: false, error: "This barcode is already registered on another product" };
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        sku: parsed.data.sku,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        unitPrice: parsed.data.unitPrice,
        categoryId: parsed.data.categoryId,
        unitId: parsed.data.unitId,
        barcode: parsed.data.barcode ?? null,
        purchaseUnitCost: parsed.data.purchaseUnitCost ?? null,
        supplierId: parsed.data.supplierId || null,
        imageUrl: parsed.data.imageUrl || null,
      },
    });

    revalidatePath("/inventory");
    return { success: true, data: product, message: "Product updated successfully" };
  } catch {
    return { success: false, error: "Failed to update product" };
  }
}

// ── Toggle Product Active State ───────────────────────────────────────────────

export async function toggleProductActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.product.update({ where: { id }, data: { isActive } });
    revalidatePath("/inventory");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update product" };
  }
}

// ── Create Stock Movement ─────────────────────────────────────────────────────

export async function createStockMovement(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const parsed = stockMovementSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const {
    stockId,
    type,
    quantity,
    unitCost,
    note,
    fromLocationId,
    toLocationId,
    purchaseOrderId,
    projectId,
  } = parsed.data;

  const movementUnitCost = type === "IN" && unitCost !== undefined ? unitCost : null;

  try {
    const stock = await prisma.stock.findUnique({ where: { id: stockId } });
    if (!stock) return { success: false, error: "Stock record not found" };

    const onHand = Number(stock.quantity);
    const reserved = Number(stock.reserved);
    const unreserved = Math.max(0, onHand - reserved);

    // Prevent negative stock on OUT movements (respect soft-reservations)
    if (type === "OUT") {
      if (onHand < quantity) {
        return {
          success: false,
          error: `Insufficient stock on hand. On hand: ${onHand}`,
        };
      }
      if (unreserved < quantity) {
        return {
          success: false,
          error: `Insufficient unreserved stock. Available (not reserved): ${unreserved}`,
        };
      }
    }

    if (type === "TRANSFER") {
      if (!toLocationId) {
        return { success: false, error: "Transfer requires a destination location" };
      }
      if (toLocationId === stock.locationId) {
        return { success: false, error: "Source and destination location must differ" };
      }
      if (onHand < quantity) {
        return {
          success: false,
          error: `Insufficient stock to transfer. On hand: ${onHand}`,
        };
      }
      if (unreserved < quantity) {
        return {
          success: false,
          error: `Cannot transfer reserved quantity. Unreserved available: ${unreserved}`,
        };
      }
    }

    // Run movement + stock update in a transaction
    await prisma.$transaction(async (tx) => {
      // Append immutable movement record
      await tx.stockMovement.create({
        data: {
          stockId,
          type,
          quantity,
          unitCost: movementUnitCost,
          note: note ?? null,
          fromLocationId: fromLocationId ?? null,
          toLocationId: toLocationId ?? null,
          userId: session.user.id,
          purchaseOrderId: purchaseOrderId ?? null,
          projectId: projectId ?? null,
        },
      });

      // Update current stock quantity (TRANSFER is handled below; ADJUSTMENT/RESERVED/RELEASED stay audit-only here)
      const delta = type === "OUT" ? -quantity : type === "IN" ? quantity : 0;
      if (delta !== 0) {
        await tx.stock.update({
          where: { id: stockId },
          data: { quantity: { increment: delta } },
        });
      }

      // TRANSFER: mirrored IN at destination + decrement source (dest row created if missing)
      if (type === "TRANSFER" && toLocationId) {
        let destStock = await tx.stock.findFirst({
          where: { productId: stock.productId, locationId: toLocationId },
        });
        if (!destStock) {
          destStock = await tx.stock.create({
            data: {
              productId: stock.productId,
              locationId: toLocationId,
              quantity: 0,
              reserved: 0,
              reorderPoint: 0,
            },
          });
        }

        await tx.stock.update({
          where: { id: destStock.id },
          data: { quantity: { increment: quantity } },
        });
        await tx.stockMovement.create({
          data: {
            stockId: destStock.id,
            type: "IN",
            quantity,
            unitCost: null,
            note: note?.trim()
              ? `Transfer in: ${note}`
              : `Transfer in from stock ${stockId.slice(0, 8)}…`,
            fromLocationId: stock.locationId,
            toLocationId,
            userId: session.user.id,
          },
        });
        await tx.stock.update({
          where: { id: stockId },
          data: { quantity: { decrement: quantity } },
        });
      }
    });

    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { success: true, data: undefined, message: "Movement recorded successfully" };
  } catch {
    return { success: false, error: "Failed to record movement" };
  }
}

// ── Scan / manual goods-in (barcode or SKU) ───────────────────────────────────

export type ProductScanPreview = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  purchaseUnitCost: number | null;
  unit: { symbol: string };
};

export async function previewProductByScanCode(code: string): Promise<ProductScanPreview | null> {
  const session = await auth();
  if (!session?.user) return null;

  const trimmed = code.trim();
  if (!trimmed) return null;

  const product = await prisma.product.findFirst({
    where: {
      isActive: true,
      OR: [{ barcode: trimmed }, { sku: trimmed }],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      purchaseUnitCost: true,
      unit: { select: { symbol: true } },
    },
  });

  if (!product) return null;

  return {
    ...product,
    purchaseUnitCost: product.purchaseUnitCost !== null ? Number(product.purchaseUnitCost) : null,
  };
}

export async function receiveIncomingGoods(
  formData: unknown
): Promise<ActionResult<{ productName: string }>> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER", "STAFF"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = receiveIncomingSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { locationId, code, quantity, note } = parsed.data;
  let resolvedUnitCost = parsed.data.unitCost;

  try {
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [{ barcode: code }, { sku: code }],
      },
      include: { unit: { select: { symbol: true } } },
    });

    if (!product) {
      return {
        success: false,
        error:
          "No active product matches this barcode or SKU. Register the product or check the code.",
      };
    }

    if (resolvedUnitCost === undefined && product.purchaseUnitCost !== null) {
      resolvedUnitCost = Number(product.purchaseUnitCost);
    }

    const unitCostDb = resolvedUnitCost !== undefined ? resolvedUnitCost : null;

    await prisma.$transaction(async (tx) => {
      let stock = await tx.stock.findFirst({
        where: { productId: product.id, locationId },
      });

      if (!stock) {
        stock = await tx.stock.create({
          data: {
            productId: product.id,
            locationId,
            quantity: 0,
            reserved: 0,
            reorderPoint: 0,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          stockId: stock.id,
          type: "IN",
          quantity,
          unitCost: unitCostDb,
          note: note?.trim() ? note.trim() : "Goods received (scan / manual)",
          toLocationId: locationId,
          userId: session.user.id,
        },
      });

      await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: { increment: quantity } },
      });

      if (resolvedUnitCost !== undefined) {
        await tx.product.update({
          where: { id: product.id },
          data: { purchaseUnitCost: resolvedUnitCost },
        });
      }
    });

    revalidatePath("/inventory");
    revalidatePath("/inventory/receive");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return {
      success: true,
      data: { productName: product.name },
      message: `Recorded ${quantity} ${product.unit.symbol} in — ${product.name}`,
    };
  } catch {
    return { success: false, error: "Failed to record goods in" };
  }
}

// ── Update Reorder Point ──────────────────────────────────────────────────────

export async function updateReorderPoint(
  stockId: string,
  reorderPoint: number
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.stock.update({
      where: { id: stockId },
      data: { reorderPoint },
    });
    revalidatePath("/inventory");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update reorder point" };
  }
}
