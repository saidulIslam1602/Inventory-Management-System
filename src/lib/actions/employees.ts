"use server";

/**
 * Employee Server Actions.
 * Handles creating employees (with linked User), recording attendance, scheduling shifts.
 */

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { employeeSchema, attendanceSchema, shiftSchema } from "@/lib/validations/employee";
import type { ActionResult } from "@/types";
import type { UserRole } from "@prisma/client";

// ── Generate employee code ────────────────────────────────────────────────────

async function generateEmployeeCode(): Promise<string> {
  const count = await prisma.employee.count();
  return `AQ-${String(count + 1).padStart(4, "0")}`;
}

// ── Create Employee ───────────────────────────────────────────────────────────

export async function createEmployee(formData: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = employeeSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { email, firstName, lastName, phone, address, hireDate, locationId, departmentId, role } =
    parsed.data;

  try {
    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { success: false, error: "A user with this email already exists" };

    // Create user account with a temporary password (they should reset it)
    const temporaryPassword = await bcrypt.hash("ChangeMe123!", 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: `${firstName} ${lastName}`,
          passwordHash: temporaryPassword,
          role: role as UserRole,
        },
      });

      const employee = await tx.employee.create({
        data: {
          employeeCode: await generateEmployeeCode(),
          firstName,
          lastName,
          phone: phone ?? null,
          address: address ?? null,
          hireDate,
          userId: user.id,
          locationId,
          departmentId: departmentId ?? null,
        },
      });

      return employee;
    });

    revalidatePath("/employees");
    return { success: true, data: { id: result.id }, message: `${firstName} ${lastName} added. Temporary password: ChangeMe123!` };
  } catch {
    return { success: false, error: "Failed to create employee" };
  }
}

// ── Update Employee ───────────────────────────────────────────────────────────

export async function updateEmployee(id: string, formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = employeeSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { firstName, lastName, phone, address, hireDate, locationId, departmentId, role } =
    parsed.data;

  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!employee) return { success: false, error: "Employee not found" };

    await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: {
          firstName,
          lastName,
          phone: phone ?? null,
          address: address ?? null,
          hireDate,
          locationId,
          departmentId: departmentId ?? null,
        },
      }),
      prisma.user.update({
        where: { id: employee.userId },
        data: {
          name: `${firstName} ${lastName}`,
          role: role as UserRole,
        },
      }),
    ]);

    revalidatePath("/employees");
    return { success: true, data: undefined, message: "Employee updated" };
  } catch {
    return { success: false, error: "Failed to update employee" };
  }
}

// ── Toggle Employee Active State ──────────────────────────────────────────────

export async function toggleEmployeeActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Admin only" };
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return { success: false, error: "Employee not found" };

    await prisma.$transaction([
      prisma.employee.update({ where: { id }, data: { isActive } }),
      prisma.user.update({ where: { id: employee.userId }, data: { isActive } }),
    ]);

    revalidatePath("/employees");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update employee" };
  }
}

// ── Record Attendance ─────────────────────────────────────────────────────────

export async function recordAttendance(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  const parsed = attendanceSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const { employeeId, date, status, checkIn, checkOut, notes } = parsed.data;

  try {
    // Calculate hours worked if both check-in and check-out are provided
    let hoursWorked: number | null = null;
    if (checkIn && checkOut) {
      hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    }

    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: { status, checkIn: checkIn ?? null, checkOut: checkOut ?? null, notes: notes ?? null, hoursWorked },
      create: { employeeId, date, status, checkIn: checkIn ?? null, checkOut: checkOut ?? null, notes: notes ?? null, hoursWorked },
    });

    revalidatePath("/employees");
    return { success: true, data: undefined, message: "Attendance recorded" };
  } catch {
    return { success: false, error: "Failed to record attendance" };
  }
}

// ── Create Shift ──────────────────────────────────────────────────────────────

export async function createShift(formData: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = shiftSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  try {
    await prisma.shift.create({ data: parsed.data });
    revalidatePath("/employees");
    return { success: true, data: undefined, message: "Shift scheduled" };
  } catch {
    return { success: false, error: "Failed to create shift" };
  }
}
