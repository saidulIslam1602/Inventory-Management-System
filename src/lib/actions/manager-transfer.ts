"use server";

/**
 * One-click internal transfers from Manager hub suggestions.
 * Delegates to createStockMovement(TRANSFER) for consistent audit + destination stock.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createStockMovement } from "@/lib/actions/inventory";
import { managerSuggestedTransferSchema } from "@/lib/validations/manager-transfer";
import { UserMessage } from "@/lib/user-messages";
import type { ActionResult } from "@/types";

export async function executeManagerSuggestedTransfer(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return {
      success: false,
      error: "Only managers and administrators can post internal transfers.",
    };
  }

  const parsed = managerSuggestedTransferSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const { productId, fromLocationId, toLocationId, quantity, note } = parsed.data;

  if (fromLocationId === toLocationId) {
    return {
      success: false,
      error: "Source and destination locations must be different.",
    };
  }

  try {
    const source = await prisma.stock.findFirst({
      where: { productId, locationId: fromLocationId },
    });
    if (!source) {
      return { success: false, error: "No stock was found at the source location." };
    }

    const destExists = await prisma.location.findFirst({
      where: { id: toLocationId, isActive: true },
      select: { id: true },
    });
    if (!destExists) {
      return { success: false, error: "The destination location is not available." };
    }

    const combinedNote = [note?.trim(), "Manager hub suggested transfer"]
      .filter(Boolean)
      .join(" — ");

    const result = await createStockMovement({
      stockId: source.id,
      type: "TRANSFER",
      quantity,
      note: combinedNote || "Manager hub suggested transfer",
      fromLocationId,
      toLocationId,
    });

    if (result.success) {
      revalidatePath("/manager");
    }

    return result;
  } catch {
    return { success: false, error: "Transfer could not be completed. Please try again." };
  }
}
