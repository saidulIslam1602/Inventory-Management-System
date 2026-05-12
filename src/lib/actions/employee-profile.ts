"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types";

const myProfileSchema = z.object({
  phone: z
    .string()
    .max(40)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  address: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
});

export async function updateMyEmployeeProfile(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };
  if (!["STAFF", "MANAGER", "ADMIN"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = myProfileSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    const emp = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    if (!emp) return { success: false, error: "No employee profile found" };

    await prisma.employee.update({
      where: { id: emp.id },
      data: {
        phone: parsed.data.phone ?? null,
        address: parsed.data.address ?? null,
      },
    });

    revalidatePath("/me");
    revalidatePath("/employees");
    return { success: true, data: undefined, message: "Profile updated" };
  } catch {
    return { success: false, error: "Failed to update profile" };
  }
}
