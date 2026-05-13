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
import { UserMessage } from "@/lib/user-messages";
import type { ActionResult } from "@/types";
import { auditDataChange } from "@/lib/audit/record-event";

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
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = projectSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  let linkedCustomer: { name: string; phone: string | null } | null = null;
  if (parsed.data.customerId) {
    linkedCustomer = await prisma.customer.findFirst({
      where: { id: parsed.data.customerId, isActive: true },
      select: { name: true, phone: true },
    });
    if (!linkedCustomer) {
      return { success: false, error: "That customer could not be found." };
    }
  }

  const clientName = parsed.data.clientName?.trim() || linkedCustomer?.name || null;
  const clientPhone = parsed.data.clientPhone?.trim() || linkedCustomer?.phone || null;

  try {
    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        locationId: parsed.data.locationId,
        startDate: parsed.data.startDate ?? null,
        endDate: parsed.data.endDate ?? null,
        description: parsed.data.description?.trim() || null,
        customerId: parsed.data.customerId ?? null,
        clientName,
        clientPhone,
        projectCode: await generateProjectCode(),
      },
    });

    await auditDataChange({
      session,
      action: "project.create",
      summary: `Created project ${project.projectCode}: ${project.name}.`,
      targetType: "Project",
      targetId: project.id,
      metadata: { projectCode: project.projectCode },
    });

    revalidatePath("/projects");
    return {
      success: true,
      data: { id: project.id },
      message: "Project was created successfully.",
    };
  } catch {
    return {
      success: false,
      error: "The project could not be created. Please try again.",
    };
  }
}

// ── Update Project Status ─────────────────────────────────────────────────────

export async function updateProjectStatus(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = projectStatusSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  try {
    const proj = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { projectCode: true, status: true },
    });
    if (!proj) return { success: false, error: "That project could not be found." };

    await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { status: parsed.data.status },
    });

    await auditDataChange({
      session,
      action: "project.status.update",
      summary: `${proj.projectCode}: ${proj.status} → ${parsed.data.status}.`,
      targetType: "Project",
      targetId: parsed.data.projectId,
      metadata: {
        projectCode: proj.projectCode,
        fromStatus: proj.status,
        toStatus: parsed.data.status,
      },
    });

    revalidatePath("/projects");
    return { success: true, data: undefined, message: "Project status was updated." };
  } catch {
    return {
      success: false,
      error: "Project status could not be updated. Please try again.",
    };
  }
}

// ── Reserve Material for Project ──────────────────────────────────────────────

export async function reserveMaterial(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = addProjectMaterialSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const { projectId, productId, reservedQuantity } = parsed.data;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectCode: true, locationId: true },
    });
    if (!project) return { success: false, error: "That project could not be found." };

    // Find stock at the project's location
    const stock = await prisma.stock.findFirst({
      where: { productId, locationId: project.locationId },
    });

    if (!stock) {
      return {
        success: false,
        error: "No stock was found for this product at the project's location.",
      };
    }

    const availableQty = Number(stock.quantity) - Number(stock.reserved);
    if (availableQty < reservedQuantity) {
      return {
        success: false,
        error: `Not enough stock is available for this reservation. Available: ${availableQty}.`,
      };
    }

    // Get current unit cost for snapshot
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { unitPrice: true, sku: true },
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

    await auditDataChange({
      session,
      action: "project.material.reserve",
      summary: `Reserved ${reservedQuantity} × ${product?.sku ?? productId} for ${project.projectCode}.`,
      targetType: "Project",
      targetId: projectId,
      metadata: {
        projectCode: project.projectCode,
        productId,
        productSku: product?.sku ?? null,
        reservedQuantity,
        stockId: stock.id,
      },
    });

    revalidatePath("/projects");
    revalidatePath("/inventory");
    return { success: true, data: undefined, message: "Material was reserved for the project." };
  } catch {
    return {
      success: false,
      error: "Material could not be reserved. Please try again.",
    };
  }
}

// ── Consume Material (triggers OUT movement) ──────────────────────────────────

export async function consumeMaterial(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER", "STAFF"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = consumeMaterialSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const { projectMaterialId, usedQuantity } = parsed.data;

  try {
    const pm = await prisma.projectMaterial.findUnique({
      where: { id: projectMaterialId },
      include: {
        project: { select: { locationId: true, projectCode: true, id: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
    });

    if (!pm) return { success: false, error: "That project material line could not be found." };

    const remaining = Number(pm.reservedQuantity) - Number(pm.usedQuantity);
    if (usedQuantity > remaining) {
      return {
        success: false,
        error: `You cannot consume more than is reserved (${remaining} remaining).`,
      };
    }

    const stock = await prisma.stock.findFirst({
      where: { productId: pm.productId, locationId: pm.project.locationId },
    });

    if (!stock) return { success: false, error: "No stock record was found for this line." };

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

    await auditDataChange({
      session,
      action: "project.material.consume",
      summary: `Consumed ${usedQuantity} of ${pm.product.sku} on ${pm.project.projectCode}.`,
      targetType: "ProjectMaterial",
      targetId: projectMaterialId,
      metadata: {
        projectCode: pm.project.projectCode,
        projectId: pm.project.id,
        productSku: pm.product.sku,
        quantity: usedQuantity,
      },
    });

    revalidatePath("/projects");
    revalidatePath("/inventory");
    return { success: true, data: undefined, message: "Consumption was recorded successfully." };
  } catch {
    return {
      success: false,
      error: "Consumption could not be recorded. Please try again.",
    };
  }
}
