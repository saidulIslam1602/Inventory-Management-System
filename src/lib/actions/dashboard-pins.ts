"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserMessage } from "@/lib/user-messages";
import type { ActionResult } from "@/types";
import {
  parseDashboardPins,
  addProductPin,
  removeProductPin,
  addProjectPin,
  removeProjectPin,
} from "@/lib/dashboard-pins";

async function requireViewerSession(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: UserMessage.auth.signInRequired };
  if (session.user.role !== "VIEWER") return { ok: false, error: UserMessage.permission.denied };
  return { ok: true, userId: session.user.id };
}

export async function setDashboardProductPinned(
  productId: string,
  pinned: boolean
): Promise<ActionResult> {
  const gate = await requireViewerSession();
  if (!gate.ok) return { success: false, error: gate.error };

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true },
    });
    if (!product) return { success: false, error: "That product could not be found." };

    const user = await prisma.user.findUnique({
      where: { id: gate.userId },
      select: { dashboardPins: true },
    });
    const state = parseDashboardPins(user?.dashboardPins);
    const next = pinned ? addProductPin(state, productId) : removeProductPin(state, productId);

    await prisma.user.update({
      where: { id: gate.userId },
      data: { dashboardPins: next as object },
    });

    revalidatePath("/dashboard");
    revalidatePath("/inventory");
    return {
      success: true,
      data: undefined,
      message: pinned ? "Added to your watchlist." : "Removed from watchlist.",
    };
  } catch {
    return { success: false, error: "Could not update watchlist. Please try again." };
  }
}

export async function setDashboardProjectPinned(
  projectId: string,
  pinned: boolean
): Promise<ActionResult> {
  const gate = await requireViewerSession();
  if (!gate.ok) return { success: false, error: gate.error };

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) return { success: false, error: "That project could not be found." };

    const user = await prisma.user.findUnique({
      where: { id: gate.userId },
      select: { dashboardPins: true },
    });
    const state = parseDashboardPins(user?.dashboardPins);
    const next = pinned ? addProjectPin(state, projectId) : removeProjectPin(state, projectId);

    await prisma.user.update({
      where: { id: gate.userId },
      data: { dashboardPins: next as object },
    });

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    return {
      success: true,
      data: undefined,
      message: pinned ? "Added to your watchlist." : "Removed from watchlist.",
    };
  } catch {
    return { success: false, error: "Could not update watchlist. Please try again." };
  }
}
