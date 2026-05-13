"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserMessage } from "@/lib/user-messages";
import { myProfileSchema } from "@/lib/validations/employee-profile";
import type { ActionResult } from "@/types";
import { auditDataChange } from "@/lib/audit/record-event";

export async function updateMyEmployeeProfile(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: UserMessage.auth.signInRequired };
  if (!["STAFF", "MANAGER", "ADMIN", "VIEWER"].includes(session.user.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = myProfileSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  try {
    const emp = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    if (!emp) {
      return {
        success: false,
        error: "No employee record is linked to your account.",
      };
    }

    await prisma.employee.update({
      where: { id: emp.id },
      data: {
        phone: parsed.data.phone ?? null,
        address: parsed.data.address ?? null,
        nationality: parsed.data.nationality ?? null,
      },
    });

    await auditDataChange({
      session,
      action: "employee.self_contact.update",
      summary: "Updated own employee contact fields.",
      targetType: "Employee",
      targetId: emp.id,
      metadata: { scope: "phone_address_nationality" },
    });

    revalidatePath("/me");
    revalidatePath("/profile");
    revalidatePath("/employees");
    return {
      success: true,
      data: undefined,
      message: "Your contact information was saved successfully.",
    };
  } catch {
    return {
      success: false,
      error: "Your contact information could not be saved. Please try again.",
    };
  }
}
