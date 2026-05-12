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
import { UserMessage } from "@/lib/user-messages";
import { canRecordStockMovement } from "@/lib/rbac";
import type { ActionResult } from "@/types";
import type { Product } from "@prisma/client";

// ── Create Product ────────────────────────────────────────────────────────────

export async function createProduct(formData: unknown): Promise<ActionResult<Product>> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = productSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  try {
    // Check SKU uniqueness
    const existing = await prisma.product.findUnique({ where: { sku: parsed.data.sku } });
    if (existing) return { success: false, error: "A product with this SKU already exists." };

    if (parsed.data.barcode) {
      const barcodeTaken = await prisma.product.findUnique({
        where: { barcode: parsed.data.barcode },
      });
      if (barcodeTaken)
        return {
          success: false,
          error: "This barcode is already used on another product.",
        };
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
    return { success: true, data: product, message: "Product was created successfully." };
  } catch {
    return {
      success: false,
      error: "The product could not be created. Please try again.",
    };
  }
}

// ── Update Product ────────────────────────────────────────────────────────────

export async function updateProduct(id: string, formData: unknown): Promise<ActionResult<Product>> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = productSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  try {
    if (parsed.data.barcode) {
      const barcodeTaken = await prisma.product.findFirst({
        where: { barcode: parsed.data.barcode, NOT: { id } },
      });
      if (barcodeTaken)
        return {
          success: false,
          error: "This barcode is already used on another product.",
        };
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
    return { success: true, data: product, message: "Product was saved successfully." };
  } catch {
    return {
      success: false,
      error: "The product could not be saved. Please try again.",
    };
  }
}

// ── Toggle Product Active State ───────────────────────────────────────────────

export async function toggleProductActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  try {
    await prisma.product.update({ where: { id }, data: { isActive } });
    revalidatePath("/inventory");
    return {
      success: true,
      data: undefined,
      message: isActive ? "Product was activated." : "Product was deactivated.",
    };
  } catch {
    return {
      success: false,
      error: "Product status could not be updated. Please try again.",
    };
  }
}

// ── Create Stock Movement ─────────────────────────────────────────────────────

export async function createStockMovement(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: UserMessage.auth.signInRequired };
  if (!canRecordStockMovement(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = stockMovementSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
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
    if (!stock) return { success: false, error: "That stock record could not be found." };

    const onHand = Number(stock.quantity);
    const reserved = Number(stock.reserved);
    const unreserved = Math.max(0, onHand - reserved);

    // Prevent negative stock on OUT movements (respect soft-reservations)
    if (type === "OUT") {
      if (onHand < quantity) {
        return {
          success: false,
          error: `Not enough stock on hand (${onHand} available).`,
        };
      }
      if (unreserved < quantity) {
        return {
          success: false,
          error: `Not enough unreserved stock (available: ${unreserved}).`,
        };
      }
    }

    if (type === "TRANSFER") {
      if (!toLocationId) {
        return {
          success: false,
          error: "A transfer must specify a destination location.",
        };
      }
      if (toLocationId === stock.locationId) {
        return {
          success: false,
          error: "Source and destination locations must be different.",
        };
      }
      if (onHand < quantity) {
        return {
          success: false,
          error: `Not enough stock to transfer (${onHand} on hand).`,
        };
      }
      if (unreserved < quantity) {
        return {
          success: false,
          error: `Cannot transfer reserved quantity (unreserved available: ${unreserved}).`,
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
    return { success: true, data: undefined, message: "Stock movement was recorded successfully." };
  } catch {
    return {
      success: false,
      error: "Stock movement could not be recorded. Please try again.",
    };
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
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = receiveIncomingSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
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
          "No active product matches this barcode or SKU. Add the product first or check the code.",
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
      message: `Recorded ${quantity} ${product.unit.symbol} in for ${product.name}.`,
    };
  } catch {
    return {
      success: false,
      error: "Goods receipt could not be recorded. Please try again.",
    };
  }
}

// ── Update Reorder Point ──────────────────────────────────────────────────────

export async function updateReorderPoint(
  stockId: string,
  reorderPoint: number
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  try {
    await prisma.stock.update({
      where: { id: stockId },
      data: { reorderPoint },
    });
    revalidatePath("/inventory");
    return { success: true, data: undefined, message: "Reorder point was updated successfully." };
  } catch {
    return {
      success: false,
      error: "Reorder point could not be updated. Please try again.",
    };
  }
}
