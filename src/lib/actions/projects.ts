"use server";

/**
 * Projects / Work Orders Server Actions.
 *
 * Projects represent installation jobs.
 * Materials can be reserved from stock (soft-reserve) and then marked as consumed
 * (which triggers an OUT stock movement and deducts from stock).
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  projectSchema,
  projectStatusSchema,
  addProjectMaterialSchema,
  consumeMaterialSchema,
} from "@/lib/validations/project";
import type { ActionResult } from "@/types";

// ── Generate project code ─────────────────────────────────────────────────────

async function generateProjectCode(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.project.count({
    where: { projectCode: { startsWith: `PRJ-${year}-` } },
  });
  return `PRJ-${year}-${String(count + 1).padStart(4, "0")}`;
}

// ── Create Project ────────────────────────────────────────────────────────────

export async function createProject(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = projectSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    const project = await prisma.project.create({
      data: {
        ...parsed.data,
        projectCode: await generateProjectCode(),
        startDate: parsed.data.startDate ?? null,
        endDate: parsed.data.endDate ?? null,
        description: parsed.data.description ?? null,
        clientName: parsed.data.clientName ?? null,
        clientPhone: parsed.data.clientPhone ?? null,
      },
    });

    revalidatePath("/projects");
    return { success: true, data: { id: project.id }, message: "Project created" };
  } catch {
    return { success: false, error: "Failed to create project" };
  }
}

// ── Update Project Status ─────────────────────────────────────────────────────

export async function updateProjectStatus(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = projectStatusSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: "Validation failed" };
  }

  try {
    await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { status: parsed.data.status },
    });
    revalidatePath("/projects");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update project" };
  }
}

// ── Reserve Material for Project ──────────────────────────────────────────────

export async function reserveMaterial(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = addProjectMaterialSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { projectId, productId, reservedQuantity } = parsed.data;

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { success: false, error: "Project not found" };

    // Find stock at the project's location
    const stock = await prisma.stock.findFirst({
      where: { productId, locationId: project.locationId },
    });

    if (!stock) return { success: false, error: "No stock found for this product at the project location" };

    const availableQty = Number(stock.quantity) - Number(stock.reserved);
    if (availableQty < reservedQuantity) {
      return {
        success: false,
        error: `Insufficient available stock. Available: ${availableQty}`,
      };
    }

    // Get current unit cost for snapshot
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { unitPrice: true },
    });

    await prisma.$transaction(async (tx) => {
      // Upsert project material record (accumulate if already exists)
      await tx.projectMaterial.upsert({
        where: { projectId_productId: { projectId, productId } },
        update: { reservedQuantity: { increment: reservedQuantity } },
        create: {
          projectId,
          productId,
          reservedQuantity,
          unitCostAtTime: product?.unitPrice ?? 0,
        },
      });

      // Soft-reserve: increase the reserved counter on stock
      await tx.stock.update({
        where: { id: stock.id },
        data: { reserved: { increment: reservedQuantity } },
      });

      // Append RESERVED movement for audit trail
      await tx.stockMovement.create({
        data: {
          stockId: stock.id,
          type: "RESERVED",
          quantity: reservedQuantity,
          note: `Reserved for project ${projectId}`,
          userId: session.user.id,
          projectId,
        },
      });
    });

    revalidatePath("/projects");
    revalidatePath("/inventory");
    return { success: true, data: undefined, message: "Material reserved" };
  } catch {
    return { success: false, error: "Failed to reserve material" };
  }
}

// ── Consume Material (triggers OUT movement) ──────────────────────────────────

export async function consumeMaterial(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER", "STAFF"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = consumeMaterialSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: "Validation failed" };
  }

  const { projectMaterialId, usedQuantity } = parsed.data;

  try {
    const pm = await prisma.projectMaterial.findUnique({
      where: { id: projectMaterialId },
      include: {
        project: { select: { locationId: true } },
        product: { select: { id: true } },
      },
    });

    if (!pm) return { success: false, error: "Project material not found" };

    const remaining = Number(pm.reservedQuantity) - Number(pm.usedQuantity);
    if (usedQuantity > remaining) {
      return { success: false, error: `Cannot consume more than reserved (${remaining} remaining)` };
    }

    const stock = await prisma.stock.findFirst({
      where: { productId: pm.productId, locationId: pm.project.locationId },
    });

    if (!stock) return { success: false, error: "Stock record not found" };

    await prisma.$transaction(async (tx) => {
      // Update consumed quantity on project material
      await tx.projectMaterial.update({
        where: { id: projectMaterialId },
        data: { usedQuantity: { increment: usedQuantity } },
      });

      // Deduct from stock quantity and reserved
      await tx.stock.update({
        where: { id: stock.id },
        data: {
          quantity: { decrement: usedQuantity },
          reserved: { decrement: usedQuantity },
        },
      });

      // Append OUT movement for audit trail
      await tx.stockMovement.create({
        data: {
          stockId: stock.id,
          type: "OUT",
          quantity: usedQuantity,
          note: `Consumed in project ${pm.projectId}`,
          userId: session.user.id,
          projectId: pm.projectId,
        },
      });
    });

    revalidatePath("/projects");
    revalidatePath("/inventory");
    return { success: true, data: undefined, message: "Consumption recorded" };
  } catch {
    return { success: false, error: "Failed to record consumption" };
  }
}
