/**
 * Shared attendance log filters (pages + CSV export).
 */

import type { AttendanceStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prismaDateForOsloCalendarDay } from "@/lib/business-calendar";

export function buildAttendanceLogWhere(params: {
  since: Date;
  status?: AttendanceStatus;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  /** When set, restrict to one employee (e.g. self for STAFF). */
  employeeId?: string;
}): Prisma.AttendanceWhereInput {
  const where: Prisma.AttendanceWhereInput = {
    date: { gte: params.since },
  };

  if (params.status) where.status = params.status;

  if (params.dateFrom || params.dateTo) {
    const startBound = params.dateFrom
      ? prismaDateForOsloCalendarDay(params.dateFrom)
      : params.since;
    const gte = startBound.getTime() > params.since.getTime() ? startBound : params.since;
    const dateClause: Prisma.DateTimeFilter = { gte };
    if (params.dateTo) {
      dateClause.lte = prismaDateForOsloCalendarDay(params.dateTo);
    }
    where.date = dateClause;
  }

  const employeeParts: Prisma.EmployeeWhereInput[] = [];
  if (params.employeeId) employeeParts.push({ id: params.employeeId });
  if (params.q) {
    employeeParts.push({
      OR: [
        { firstName: { contains: params.q, mode: "insensitive" } },
        { lastName: { contains: params.q, mode: "insensitive" } },
        { employeeCode: { contains: params.q, mode: "insensitive" } },
      ],
    });
  }
  if (employeeParts.length === 1) {
    where.employee = employeeParts[0];
  } else if (employeeParts.length > 1) {
    where.employee = { AND: employeeParts };
  }

  return where;
}

export const attendanceLogInclude = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeCode: true,
      location: { select: { name: true } },
    },
  },
} as const satisfies Prisma.AttendanceInclude;
