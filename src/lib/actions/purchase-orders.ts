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
import { NotificationType, type POStatus } from "@prisma/client";
import {
  purchaseOrderSchema,
  receiveItemsSchema,
  escalationNoteSchema,
} from "@/lib/validations/purchase-order";
import { UserMessage } from "@/lib/user-messages";
import type { ActionResult } from "@/types";
import {
  getOpsLeaderUserIds,
  notifyUsersForInstantPoPreference,
} from "@/lib/manager/notify-by-preference";
import { auditDataChange } from "@/lib/audit/record-event";

// ── Generate PO number (atomic) ───────────────────────────────────────────────
//
// Uses a PostgreSQL session-level advisory lock keyed on the year so that
// concurrent createPurchaseOrder calls cannot receive the same sequence number.
// The lock is released automatically when the DB connection is returned to the pool.

async function generatePONumberAtomic(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
  const year = new Date().getFullYear();
  // Lock key is stable per year: 20260000 for 2026, etc.
  const lockKey = year * 10_000;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
  const rows = await tx.$queryRaw<[{ c: bigint }]>`
    SELECT COUNT(*) AS c FROM purchase_orders WHERE po_number LIKE ${"PO-" + year + "-%"}
  `;
  const seq = Number(rows[0]?.c ?? 0) + 1;
  return `PO-${year}-${String(seq).padStart(4, "0")}`;
}

// ── Create PO ─────────────────────────────────────────────────────────────────

export async function createPurchaseOrder(
  formData: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = purchaseOrderSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  try {
    const { supplierId, locationId, expectedDate, notes, items } = parsed.data;

    const totalAmount =
      Math.round(
        items.reduce((sum, item) => sum + item.orderedQuantity * item.unitPrice, 0) * 100
      ) / 100;

    // Generate PO number and create the record atomically to prevent duplicate sequence numbers
    const po = await prisma.$transaction(async (tx) => {
      const poNumber = await generatePONumberAtomic(tx);
      return tx.purchaseOrder.create({
        data: {
          poNumber,
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
    });

    await auditDataChange({
      session,
      action: "po.create",
      summary: `Created purchase order ${po.poNumber} (${items.length} line(s), total ${totalAmount}).`,
      targetType: "PurchaseOrder",
      targetId: po.id,
      metadata: { poNumber: po.poNumber, lineCount: items.length, totalAmount },
    });

    revalidatePath("/purchase-orders");
    return {
      success: true,
      data: { id: po.id },
      message: "Purchase order was created successfully.",
    };
  } catch {
    return {
      success: false,
      error: "The purchase order could not be created. Please try again.",
    };
  }
}

// ── Advance PO Status ─────────────────────────────────────────────────────────

export async function advancePOStatus(
  poId: string,
  action: "submit" | "approve" | "order" | "cancel"
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: UserMessage.auth.signInRequired };

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { id: true, status: true, poNumber: true, createdById: true },
  });
  if (!po) return { success: false, error: "That purchase order could not be found." };

  const STATUS_TRANSITIONS: Record<string, { from: string[]; to: string; requiredRole: string[] }> =
    {
      submit: { from: ["DRAFT"], to: "SUBMITTED", requiredRole: ["ADMIN", "MANAGER", "STAFF"] },
      approve: { from: ["SUBMITTED"], to: "APPROVED", requiredRole: ["ADMIN", "MANAGER"] },
      order: { from: ["APPROVED"], to: "ORDERED", requiredRole: ["ADMIN", "MANAGER"] },
      cancel: {
        from: ["DRAFT", "SUBMITTED", "APPROVED"],
        to: "CANCELLED",
        requiredRole: ["ADMIN", "MANAGER"],
      },
    };

  const transition = STATUS_TRANSITIONS[action];
  if (!transition.requiredRole.includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.deniedForAction };
  }
  if (!transition.from.includes(po.status)) {
    return {
      success: false,
      error: `This step is not available while the purchase order is in ${po.status} status.`,
    };
  }

  try {
    const fromStatus = po.status;
    const toStatus = transition.to as POStatus;

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: toStatus },
      });
      await tx.purchaseOrderAuditLog.create({
        data: {
          purchaseOrderId: poId,
          actorUserId: session.user.id,
          kind: "STATUS_CHANGE",
          fromStatus,
          toStatus,
          details: action === "cancel" ? `Cancelled via workflow (${action}).` : null,
        },
      });
    });

    if (action === "submit") {
      const leaderIds = await getOpsLeaderUserIds();
      void notifyUsersForInstantPoPreference({
        preferenceKey: "poSubmitted",
        type: NotificationType.PO_SUBMITTED,
        title: "Purchase order submitted",
        message: `${po.poNumber} is waiting for approval.`,
        actionHref: `/purchase-orders/${poId}`,
        candidateUserIds: leaderIds,
      });
    } else if (action === "approve") {
      const leaderIds = await getOpsLeaderUserIds();
      void notifyUsersForInstantPoPreference({
        preferenceKey: "poApproved",
        type: NotificationType.PO_APPROVED,
        title: "Purchase order approved",
        message: `${po.poNumber} was approved and can be ordered.`,
        actionHref: `/purchase-orders/${poId}`,
        candidateUserIds: [...leaderIds, po.createdById],
      });
    } else if (action === "order") {
      const leaderIds = await getOpsLeaderUserIds();
      void notifyUsersForInstantPoPreference({
        preferenceKey: "poOrdered",
        type: NotificationType.PO_ORDERED,
        title: "Purchase order placed",
        message: `${po.poNumber} was marked as ordered with the supplier.`,
        actionHref: `/purchase-orders/${poId}`,
        candidateUserIds: [...leaderIds, po.createdById],
      });
    }

    await auditDataChange({
      session,
      action: `po.workflow.${action}`,
      summary: `${po.poNumber}: ${fromStatus} → ${toStatus} (${action}).`,
      targetType: "PurchaseOrder",
      targetId: poId,
      metadata: { poNumber: po.poNumber, fromStatus, toStatus, workflowStep: action },
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${poId}`);
    revalidatePath("/manager");
    return { success: true, data: undefined };
  } catch {
    return {
      success: false,
      error: "Purchase order status could not be updated. Please try again.",
    };
  }
}

// ── Receive Items (creates IN stock movements) ────────────────────────────────

export async function receiveItems(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER", "STAFF"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = receiveItemsSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const { purchaseOrderId, items } = parsed.data;

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: { include: { product: true } } },
    });

    if (!po) return { success: false, error: "That purchase order could not be found." };
    if (!["ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)) {
      return {
        success: false,
        error:
          "Goods can only be received while the purchase order is ordered or partially received.",
      };
    }

    const statusBeforeReceive = po.status as POStatus;

    for (const receiveItem of items) {
      if (receiveItem.receivedQuantity <= 0) continue;
      const poItem = po.items.find((i) => i.id === receiveItem.itemId);
      if (!poItem) {
        return {
          success: false,
          error: "One of the lines on this purchase order could not be matched.",
        };
      }
      const nextReceived = Number(poItem.receivedQuantity) + receiveItem.receivedQuantity;
      const ordered = Number(poItem.orderedQuantity);
      if (nextReceived > ordered + 1e-9) {
        return {
          success: false,
          error: `Received quantity is too high for ${poItem.product?.sku ?? "this line"} (${nextReceived} > ${ordered} ordered).`,
        };
      }
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
            unitCost: Number(poItem.unitPrice),
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

      const toStatus: POStatus = allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: toStatus,
          receivedAt: allReceived ? new Date() : null,
        },
      });

      const receiptLines = items.filter((i) => i.receivedQuantity > 0);
      const qtySum = receiptLines.reduce((s, i) => s + i.receivedQuantity, 0);
      await tx.purchaseOrderAuditLog.create({
        data: {
          purchaseOrderId,
          actorUserId: session.user.id,
          kind: "RECEIPT",
          fromStatus: statusBeforeReceive,
          toStatus,
          details: `Received ${receiptLines.length} line(s), ${qtySum} units. ${allReceived ? "PO complete." : "Partial — more expected."}`,
        },
      });
    });

    const receiptLines = items.filter((i) => i.receivedQuantity > 0);
    const qtySum = receiptLines.reduce((s, i) => s + i.receivedQuantity, 0);

    const updatedPo = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { poNumber: true, status: true, createdById: true },
    });
    if (updatedPo) {
      const leaderIds = await getOpsLeaderUserIds();
      const full = updatedPo.status === "RECEIVED";
      void notifyUsersForInstantPoPreference({
        preferenceKey: "poReceived",
        type: NotificationType.PO_RECEIVED,
        title: full ? "Purchase order fully received" : "Purchase order partially received",
        message: full
          ? `${updatedPo.poNumber} is fully received.`
          : `${updatedPo.poNumber} had lines received; fulfillment is still partial.`,
        actionHref: `/purchase-orders/${purchaseOrderId}`,
        candidateUserIds: [...leaderIds, updatedPo.createdById],
      });
    }

    await auditDataChange({
      session,
      action: "po.receive",
      summary: `Received ${qtySum} units on ${po.poNumber} (${receiptLines.length} line(s)); PO status → ${updatedPo?.status ?? po.status}.`,
      targetType: "PurchaseOrder",
      targetId: purchaseOrderId,
      metadata: {
        poNumber: po.poNumber,
        lineCount: receiptLines.length,
        qtySum,
        statusAfter: updatedPo?.status ?? po.status,
      },
    });

    revalidatePath("/purchase-orders");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/manager");
    revalidatePath(`/purchase-orders/${purchaseOrderId}`);
    return {
      success: true,
      data: undefined,
      message: "Items were received and inventory was updated successfully.",
    };
  } catch {
    return {
      success: false,
      error: "Receiving could not be completed. Please try again.",
    };
  }
}

// ── Manager escalation note (append-only audit; ADMIN / MANAGER) ──────────────

export async function addPurchaseOrderEscalationNote(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = escalationNoteSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const { purchaseOrderId, note } = parsed.data;

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { id: true },
    });
    if (!po) {
      return { success: false, error: "That purchase order could not be found." };
    }

    await prisma.purchaseOrderAuditLog.create({
      data: {
        purchaseOrderId,
        actorUserId: session.user.id,
        kind: "ESCALATION_NOTE",
        details: note,
      },
    });

    await auditDataChange({
      session,
      action: "po.escalation_note.add",
      summary: "Added escalation note on purchase order.",
      targetType: "PurchaseOrder",
      targetId: purchaseOrderId,
      metadata: { noteLength: note.length },
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${purchaseOrderId}`);
    revalidatePath("/manager");
    return { success: true, data: undefined, message: "Note recorded on the PO activity log." };
  } catch {
    return {
      success: false,
      error: "The note could not be saved. Please try again.",
    };
  }
}
