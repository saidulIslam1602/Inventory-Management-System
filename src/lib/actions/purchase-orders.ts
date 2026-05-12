"use server";

/**
 * Purchase Order Server Actions.
 *
 * PO lifecycle: DRAFT → SUBMITTED → APPROVED → ORDERED → (PARTIALLY_)RECEIVED
 * Each receiving event creates stock IN movements and updates quantities.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { purchaseOrderSchema, receiveItemsSchema } from "@/lib/validations/purchase-order";
import type { ActionResult } from "@/types";

// ── Generate PO number ────────────────────────────────────────────────────────

async function generatePONumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.purchaseOrder.count({
    where: { poNumber: { startsWith: `PO-${year}-` } },
  });
  return `PO-${year}-${String(count + 1).padStart(4, "0")}`;
}

// ── Create PO ─────────────────────────────────────────────────────────────────

export async function createPurchaseOrder(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = purchaseOrderSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    const { supplierId, locationId, expectedDate, notes, items } = parsed.data;

    // Calculate total from line items
    const totalAmount = items.reduce((sum, item) => sum + item.orderedQuantity * item.unitPrice, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: await generatePONumber(),
        supplierId,
        locationId,
        expectedDate: expectedDate ?? null,
        notes: notes ?? null,
        totalAmount,
        createdById: session.user.id,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            orderedQuantity: item.orderedQuantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });

    revalidatePath("/purchase-orders");
    return { success: true, data: { id: po.id }, message: "Purchase order created" };
  } catch {
    return { success: false, error: "Failed to create purchase order" };
  }
}

// ── Advance PO Status ─────────────────────────────────────────────────────────

export async function advancePOStatus(
  poId: string,
  action: "submit" | "approve" | "order" | "cancel"
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) return { success: false, error: "Purchase order not found" };

  const STATUS_TRANSITIONS: Record<string, { from: string[]; to: string; requiredRole: string[] }> = {
    submit: { from: ["DRAFT"], to: "SUBMITTED", requiredRole: ["ADMIN", "MANAGER", "STAFF"] },
    approve: { from: ["SUBMITTED"], to: "APPROVED", requiredRole: ["ADMIN", "MANAGER"] },
    order: { from: ["APPROVED"], to: "ORDERED", requiredRole: ["ADMIN", "MANAGER"] },
    cancel: { from: ["DRAFT", "SUBMITTED", "APPROVED"], to: "CANCELLED", requiredRole: ["ADMIN", "MANAGER"] },
  };

  const transition = STATUS_TRANSITIONS[action];
  if (!transition.requiredRole.includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions for this action" };
  }
  if (!transition.from.includes(po.status)) {
    return { success: false, error: `Cannot ${action} a PO with status ${po.status}` };
  }

  try {
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: transition.to as "SUBMITTED" | "APPROVED" | "ORDERED" | "CANCELLED" },
    });
    revalidatePath("/purchase-orders");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update status" };
  }
}

// ── Receive Items (creates IN stock movements) ────────────────────────────────

export async function receiveItems(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER", "STAFF"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = receiveItemsSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { purchaseOrderId, items } = parsed.data;

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: { include: { product: true } } },
    });

    if (!po) return { success: false, error: "Purchase order not found" };
    if (!["ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)) {
      return { success: false, error: "PO must be in ORDERED or PARTIALLY_RECEIVED status" };
    }

    await prisma.$transaction(async (tx) => {
      for (const receiveItem of items) {
        if (receiveItem.receivedQuantity <= 0) continue;

        const poItem = po.items.find((i) => i.id === receiveItem.itemId);
        if (!poItem) continue;

        // Update received quantity on the PO item
        await tx.purchaseOrderItem.update({
          where: { id: receiveItem.itemId },
          data: { receivedQuantity: { increment: receiveItem.receivedQuantity } },
        });

        // Find or create stock record at the delivery location
        let stock = await tx.stock.findFirst({
          where: { productId: poItem.productId, locationId: po.locationId },
        });

        if (!stock) {
          stock = await tx.stock.create({
            data: {
              productId: poItem.productId,
              locationId: po.locationId,
              quantity: 0,
              reorderPoint: 0,
            },
          });
        }

        // Record IN movement
        await tx.stockMovement.create({
          data: {
            stockId: stock.id,
            type: "IN",
            quantity: receiveItem.receivedQuantity,
            note: `Received from PO ${po.poNumber}`,
            toLocationId: po.locationId,
            userId: session.user.id,
            purchaseOrderId: purchaseOrderId,
          },
        });

        // Increment stock
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: { increment: receiveItem.receivedQuantity } },
        });
      }

      // Determine new PO status based on whether all items are fully received
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId },
      });

      const allReceived = updatedItems.every(
        (i) => Number(i.receivedQuantity) >= Number(i.orderedQuantity)
      );

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
          receivedAt: allReceived ? new Date() : null,
        },
      });
    });

    revalidatePath("/purchase-orders");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { success: true, data: undefined, message: "Items received and stock updated" };
  } catch {
    return { success: false, error: "Failed to process receiving" };
  }
}
