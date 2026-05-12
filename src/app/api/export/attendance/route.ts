/**
 * CSV export for attendance log (authenticated).
 */

import { NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchParamFirst } from "@/lib/search-params";
import { addCalendarDaysPrismaDate, todayOsloPrismaDate } from "@/lib/business-calendar";
import { rowsToCsv, withUtf8Bom } from "@/lib/csv";
import { attendanceLogInclude, buildAttendanceLogWhere } from "@/lib/queries/attendance-log";

const LOOKBACK_DAYS = 90;
const EXPORT_CAP = 50_000;
const ATT_STATUSES = Object.values(AttendanceStatus);

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pick = (k: string) => searchParamFirst(searchParams.get(k) ?? undefined);

  const statusRaw = pick("status");
  const status =
    statusRaw && (ATT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as AttendanceStatus)
      : undefined;

  const since = addCalendarDaysPrismaDate(todayOsloPrismaDate(), -LOOKBACK_DAYS);

  const selfEmp =
    session.user.role === "STAFF"
      ? await prisma.employee.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })
      : null;
  if (session.user.role === "STAFF" && !selfEmp) {
    return NextResponse.json({ error: "No employee profile" }, { status: 403 });
  }

  const where = buildAttendanceLogWhere({
    since,
    status,
    q: session.user.role === "STAFF" ? undefined : pick("q"),
    dateFrom: pick("from"),
    dateTo: pick("to"),
    employeeId: selfEmp?.id,
  });

  const rows = await prisma.attendance.findMany({
    where,
    orderBy: [{ date: "desc" }, { employee: { lastName: "asc" } }],
    take: EXPORT_CAP,
    include: attendanceLogInclude,
  });

  const headers = [
    "Date",
    "Employee",
    "Code",
    "Location",
    "Status",
    "Check in",
    "Check out",
    "Hours",
    "Notes",
  ];
  const data = rows.map((r) => [
    r.date.toISOString().slice(0, 10),
    `${r.employee.firstName} ${r.employee.lastName}`,
    r.employee.employeeCode,
    r.employee.location.name,
    r.status,
    r.checkIn ? r.checkIn.toISOString() : "",
    r.checkOut ? r.checkOut.toISOString() : "",
    r.hoursWorked != null ? Number(r.hoursWorked) : "",
    r.notes ?? "",
  ]);

  const csv = withUtf8Bom(rowsToCsv(headers, data));
  const truncated = rows.length >= EXPORT_CAP;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${new Date().toISOString().slice(0, 10)}.csv"`,
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
}
