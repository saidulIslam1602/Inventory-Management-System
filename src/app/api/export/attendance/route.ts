/**
 * CSV export for attendance log (authenticated).
 */

import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchParamFirst } from "@/lib/search-params";
import { addCalendarDaysPrismaDate, todayOsloPrismaDate } from "@/lib/business-calendar";
import { rowsToCsv, withUtf8Bom } from "@/lib/csv";
import { attendanceLogInclude, buildAttendanceLogWhere } from "@/lib/queries/attendance-log";
import { attendanceExportQuerySchema } from "@/lib/validations/export-queries";
import { UserMessage } from "@/lib/user-messages";
import { canExportAttendanceCsv } from "@/lib/rbac";
import { auditCsvExportDownload } from "@/lib/audit/record-event";

const LOOKBACK_DAYS = 90;
const EXPORT_CAP = 50_000;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: UserMessage.api.unauthorized }, { status: 401 });
  }
  if (!canExportAttendanceCsv(session.user.role)) {
    return NextResponse.json({ error: UserMessage.api.forbidden }, { status: 403 });
  }

  const limited = await checkApiRateLimit(req, {
    store: "api:export:attendance",
    limit: 10,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const since = addCalendarDaysPrismaDate(todayOsloPrismaDate(), -LOOKBACK_DAYS);

  const selfEmp =
    session.user.role === "STAFF"
      ? await prisma.employee.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })
      : null;
  if (session.user.role === "STAFF" && !selfEmp) {
    return NextResponse.json({ error: UserMessage.api.noEmployeeLinked }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const pick = (k: string) => searchParamFirst(searchParams.get(k) ?? undefined);

  const filters = attendanceExportQuerySchema.safeParse({
    status: pick("status"),
    q: session.user.role === "STAFF" ? undefined : pick("q"),
    from: pick("from"),
    to: pick("to"),
  });
  if (!filters.success) {
    return NextResponse.json(
      {
        error: filters.error.issues[0]?.message ?? UserMessage.api.invalidExportFilters,
      },
      { status: 400 }
    );
  }

  const { status, q: qFilter, from: fromFilter, to: toFilter } = filters.data;

  const where = buildAttendanceLogWhere({
    since,
    status,
    q: qFilter,
    dateFrom: fromFilter,
    dateTo: toFilter,
    employeeId: selfEmp?.id,
  });

  try {
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

    await auditCsvExportDownload({
      req,
      actor: { id: session.user.id, email: session.user.email },
      exportKind: "attendance_csv",
      summary: `Exported attendance CSV (${rows.length} rows${truncated ? ", truncated" : ""}).`,
      metadata: {
        filters: filters.data,
        rowCount: rows.length,
        truncated,
        scope: session.user.role === "STAFF" ? "self" : "org",
      },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${new Date().toISOString().slice(0, 10)}.csv"`,
        ...(truncated ? { "X-Export-Truncated": "true" } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
