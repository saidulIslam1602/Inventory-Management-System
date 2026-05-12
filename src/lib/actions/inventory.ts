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
import { productSchema, stockMovementSchema } from "@/lib/validations/inventory";
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

    const product = await prisma.product.create({
      data: {
        ...parsed.data,
        supplierId: parsed.data.supplierId || null,
        imageUrl: parsed.data.imageUrl || null,
        description: parsed.data.description || null,
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
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...parsed.data,
        supplierId: parsed.data.supplierId || null,
        imageUrl: parsed.data.imageUrl || null,
        description: parsed.data.description || null,
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

  const { stockId, type, quantity, note, fromLocationId, toLocationId, purchaseOrderId, projectId } =
    parsed.data;

  try {
    const stock = await prisma.stock.findUnique({ where: { id: stockId } });
    if (!stock) return { success: false, error: "Stock record not found" };

    // Prevent negative stock on OUT movements
    if (type === "OUT" && Number(stock.quantity) < quantity) {
      return {
        success: false,
        error: `Insufficient stock. Available: ${Number(stock.quantity)}`,
      };
    }

    // Run movement + stock update in a transaction
    await prisma.$transaction(async (tx) => {
      // Append immutable movement record
      await tx.stockMovement.create({
        data: {
          stockId,
          type,
          quantity,
          note: note ?? null,
          fromLocationId: fromLocationId ?? null,
          toLocationId: toLocationId ?? null,
          userId: session.user.id,
          purchaseOrderId: purchaseOrderId ?? null,
          projectId: projectId ?? null,
        },
      });

      // Update current stock quantity
      const delta = type === "OUT" ? -quantity : type === "IN" ? quantity : 0;
      if (delta !== 0) {
        await tx.stock.update({
          where: { id: stockId },
          data: { quantity: { increment: delta } },
        });
      }

      // For TRANSFER: create a corresponding IN movement at the destination
      if (type === "TRANSFER" && toLocationId) {
        const destStock = await tx.stock.findFirst({
          where: {
            productId: stock.productId,
            locationId: toLocationId,
          },
        });

        if (destStock) {
          await tx.stock.update({
            where: { id: destStock.id },
            data: { quantity: { increment: quantity } },
          });
          await tx.stockMovement.create({
            data: {
              stockId: destStock.id,
              type: "IN",
              quantity,
              note: `Transfer from ${fromLocationId}`,
              fromLocationId: fromLocationId ?? null,
              toLocationId,
              userId: session.user.id,
            },
          });
          // Deduct from source
          await tx.stock.update({
            where: { id: stockId },
            data: { quantity: { decrement: quantity } },
          });
        }
      }
    });

    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { success: true, data: undefined, message: "Movement recorded successfully" };
  } catch {
    return { success: false, error: "Failed to record movement" };
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
