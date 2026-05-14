"use server";

import { AuditEventCategory, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractAuditMetaFromNextHeaders, recordAuditEventSafe } from "@/lib/audit/record-event";
import { createEmployeeSchema, updateEmployeeSchema } from "@/lib/validations/employee";
import { UserMessage } from "@/lib/user-messages";
import type { ActionResult } from "@/types";

function canManageEmployees(role: string | undefined) {
  return role === "ADMIN" || role === "MANAGER";
}

/** Managers may not assign the ADMIN role */
function assertRoleAllowed(actorRole: string, targetRole: UserRole) {
  if (actorRole === "MANAGER" && targetRole === UserRole.ADMIN) {
    return { ok: false as const, error: "Only an administrator can assign the Admin role." };
  }
  return { ok: true as const };
}

async function nextEmployeeCode(): Promise<string> {
  const rows = await prisma.employee.findMany({
    select: { employeeCode: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = /^AQ-(\d+)$/i.exec(r.employeeCode);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `AQ-${String(max + 1).padStart(4, "0")}`;
}

export async function createEmployee(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!canManageEmployees(session?.user?.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = createEmployeeSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const perm = assertRoleAllowed(session!.user!.role, parsed.data.role);
  if (!perm.ok) return { success: false, error: perm.error };

  const employeeCode = parsed.data.employeeCode ?? (await nextEmployeeCode());

  const existingCode = await prisma.employee.findUnique({ where: { employeeCode } });
  if (existingCode) return { success: false, error: "This employee code is already in use." };

  const existingEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingEmail) {
    return { success: false, error: "An account with this email address already exists." };
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: fullName,
          email: parsed.data.email.trim().toLowerCase(),
          passwordHash,
          role: parsed.data.role,
          mustChangePassword: true,
        },
      });

      const employee = await tx.employee.create({
        data: {
          employeeCode,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          hireDate: parsed.data.hireDate,
          phone: parsed.data.phone ?? null,
          address: parsed.data.address ?? null,
          photoUrl: parsed.data.photoUrl ?? null,
          isActive: parsed.data.isActive ?? true,
          userId: user.id,
          locationId: parsed.data.locationId,
          departmentId: parsed.data.departmentId ?? null,
        },
      });
      return {
        employeeId: employee.id,
        userId: user.id,
        employeeCode: employee.employeeCode,
        role: parsed.data.role,
      };
    });

    const auditMeta = await extractAuditMetaFromNextHeaders();
    await recordAuditEventSafe({
      actorUserId: session!.user!.id,
      actorEmail: session!.user!.email,
      category: AuditEventCategory.DATA,
      action: "employee.create",
      targetType: "Employee",
      targetId: result.employeeId,
      summary: `Employee ${result.employeeCode} created (${parsed.data.firstName} ${parsed.data.lastName}, ${result.role}).`,
      metadata: {
        employeeId: result.employeeId,
        userId: result.userId,
        employeeCode: result.employeeCode,
        role: result.role,
      },
      ...auditMeta,
    });

    revalidatePath("/employees");
    revalidatePath("/settings/audit-log");
    return {
      success: true,
      data: { id: result.employeeId },
      message:
        "Employee was created successfully. They will be prompted to set a new password when they first sign in.",
    };
  } catch {
    return {
      success: false,
      error: "The employee could not be created. Please try again.",
    };
  }
}

export async function updateEmployee(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!canManageEmployees(session?.user?.role)) {
    return { success: false, error: UserMessage.permission.denied };
  }

  const parsed = updateEmployeeSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? UserMessage.validation.invalidInput,
    };
  }

  const perm = assertRoleAllowed(session!.user!.role, parsed.data.role);
  if (!perm.ok) return { success: false, error: perm.error };

  const emp = await prisma.employee.findUnique({
    where: { id: parsed.data.employeeId },
    include: { user: true },
  });
  if (!emp) return { success: false, error: "That employee could not be found." };

  const codeOwner = await prisma.employee.findFirst({
    where: { employeeCode: parsed.data.employeeCode, NOT: { id: emp.id } },
  });
  if (codeOwner) return { success: false, error: "This employee code is already in use." };

  if (parsed.data.email.trim().toLowerCase() !== emp.user.email.trim().toLowerCase()) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: parsed.data.email.trim().toLowerCase() },
    });
    if (emailTaken) {
      return { success: false, error: "An account with this email address already exists." };
    }
  }

  try {
    const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
    const passwordHash =
      parsed.data.newPassword != null ? await bcrypt.hash(parsed.data.newPassword, 12) : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: emp.userId },
        data: {
          name: fullName,
          email: parsed.data.email.trim().toLowerCase(),
          role: parsed.data.role,
          ...(passwordHash ? { passwordHash, mustChangePassword: false } : {}),
        },
      });

      await tx.employee.update({
        where: { id: emp.id },
        data: {
          employeeCode: parsed.data.employeeCode,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          hireDate: parsed.data.hireDate,
          phone: parsed.data.phone ?? null,
          address: parsed.data.address ?? null,
          photoUrl: parsed.data.photoUrl ?? null,
          isActive: parsed.data.isActive,
          locationId: parsed.data.locationId,
          departmentId: parsed.data.departmentId ?? null,
        },
      });
    });

    const auditMeta = await extractAuditMetaFromNextHeaders();
    await recordAuditEventSafe({
      actorUserId: session!.user!.id,
      actorEmail: session!.user!.email,
      category: AuditEventCategory.DATA,
      action: "employee.update",
      targetType: "Employee",
      targetId: emp.id,
      summary: `Employee ${parsed.data.employeeCode} updated.`,
      metadata: {
        employeeId: emp.id,
        userId: emp.userId,
        roleChangedTo: parsed.data.role,
        passwordRotated: Boolean(passwordHash),
      },
      ...auditMeta,
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${emp.id}`);
    revalidatePath("/settings/audit-log");
    return { success: true, data: undefined, message: "Employee was saved successfully." };
  } catch {
    return {
      success: false,
      error: "The employee could not be saved. Please try again.",
    };
  }
}
