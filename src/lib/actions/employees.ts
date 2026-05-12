"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createEmployeeSchema, updateEmployeeSchema } from "@/lib/validations/employee";
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
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = createEmployeeSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const perm = assertRoleAllowed(session!.user!.role, parsed.data.role);
  if (!perm.ok) return { success: false, error: perm.error };

  const employeeCode = parsed.data.employeeCode ?? (await nextEmployeeCode());

  const existingCode = await prisma.employee.findUnique({ where: { employeeCode } });
  if (existingCode) return { success: false, error: "Employee code already in use" };

  const existingEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingEmail) return { success: false, error: "A user with this email already exists" };

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: fullName,
          email: parsed.data.email,
          passwordHash,
          role: parsed.data.role,
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
      return employee;
    });

    revalidatePath("/employees");
    return { success: true, data: { id: result.id }, message: "Employee created" };
  } catch {
    return { success: false, error: "Failed to create employee" };
  }
}

export async function updateEmployee(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!canManageEmployees(session?.user?.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = updateEmployeeSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const perm = assertRoleAllowed(session!.user!.role, parsed.data.role);
  if (!perm.ok) return { success: false, error: perm.error };

  const emp = await prisma.employee.findUnique({
    where: { id: parsed.data.employeeId },
    include: { user: true },
  });
  if (!emp) return { success: false, error: "Employee not found" };

  const codeOwner = await prisma.employee.findFirst({
    where: { employeeCode: parsed.data.employeeCode, NOT: { id: emp.id } },
  });
  if (codeOwner) return { success: false, error: "Employee code already in use" };

  if (parsed.data.email !== emp.user.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken) return { success: false, error: "A user with this email already exists" };
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
          email: parsed.data.email,
          role: parsed.data.role,
          ...(passwordHash ? { passwordHash } : {}),
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

    revalidatePath("/employees");
    revalidatePath(`/employees/${emp.id}`);
    return { success: true, data: undefined, message: "Employee updated" };
  } catch {
    return { success: false, error: "Failed to update employee" };
  }
}
