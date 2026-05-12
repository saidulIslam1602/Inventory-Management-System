"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCustomerSchema, updateCustomerSchema } from "@/lib/validations/customer";
import { UserMessage } from "@/lib/user-messages";
import type { ActionResult } from "@/types";

function canManageCustomers(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export async function createCustomer(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!canManageCustomers(session?.user?.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = createCustomerSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  try {
    const row = await prisma.customer.create({
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        address: parsed.data.address?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        isActive: true,
      },
    });
    revalidatePath("/customers");
    revalidatePath(`/customers/${row.id}`);
    revalidatePath("/projects");
    return { success: true, data: { id: row.id }, message: "Customer was created successfully." };
  } catch {
    return {
      success: false,
      error: "The customer could not be created. Please try again.",
    };
  }
}

export async function updateCustomer(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!canManageCustomers(session?.user?.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = updateCustomerSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  try {
    const exists = await prisma.customer.findUnique({
      where: { id: parsed.data.id },
      select: { id: true },
    });
    if (!exists) return { success: false, error: "That customer could not be found." };

    await prisma.customer.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        address: parsed.data.address?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/customers");
    revalidatePath(`/customers/${parsed.data.id}`);
    revalidatePath("/projects");
    return { success: true, data: undefined, message: "Customer was saved successfully." };
  } catch {
    return {
      success: false,
      error: "The customer could not be saved. Please try again.",
    };
  }
}
