"use server";

/**
 * Self-service attendance: check-in / check-out (Oslo calendar day).
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayOsloPrismaDate } from "@/lib/business-calendar";
import type { ActionResult } from "@/types";

async function getSelfServiceEmployee() {
  const session = await auth();
  if (!session?.user) return { session: null, emp: null };
  if (!["STAFF", "MANAGER", "ADMIN"].includes(session.user.role)) {
    return { session, emp: null };
  }
  const emp = await prisma.employee.findUnique({
    where: { userId: session.user.id },
  });
  return { session, emp };
}

export async function checkInAttendance(): Promise<ActionResult> {
  const { session, emp } = await getSelfServiceEmployee();
  if (!session?.user) return { success: false, error: "Not authenticated" };
  if (!emp?.isActive)
    return { success: false, error: "No active employee profile linked to your account" };

  const today = todayOsloPrismaDate();
  const now = new Date();

  try {
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: today } },
    });

    if (!existing) {
      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          date: today,
          status: "PRESENT",
          checkIn: now,
        },
      });
    } else if (!existing.checkIn) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: { checkIn: now, status: "PRESENT" },
      });
    } else {
      return { success: false, error: "You already checked in today" };
    }

    revalidatePath("/me");
    revalidatePath("/dashboard");
    revalidatePath("/employees/attendance");
    return { success: true, data: undefined, message: "Checked in" };
  } catch {
    return { success: false, error: "Could not record check-in" };
  }
}

export async function checkOutAttendance(): Promise<ActionResult> {
  const { session, emp } = await getSelfServiceEmployee();
  if (!session?.user) return { success: false, error: "Not authenticated" };
  if (!emp?.isActive)
    return { success: false, error: "No active employee profile linked to your account" };

  const today = todayOsloPrismaDate();
  const now = new Date();

  try {
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: today } },
    });

    if (!existing?.checkIn) {
      return { success: false, error: "Check in first" };
    }
    if (existing.checkOut) {
      return { success: false, error: "You already checked out today" };
    }

    const hours = (now.getTime() - existing.checkIn.getTime()) / 3_600_000;
    const hoursWorked = Math.round(hours * 100) / 100;

    await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        hoursWorked,
      },
    });

    revalidatePath("/me");
    revalidatePath("/dashboard");
    revalidatePath("/employees/attendance");
    return { success: true, data: undefined, message: "Checked out" };
  } catch {
    return { success: false, error: "Could not record check-out" };
  }
}
