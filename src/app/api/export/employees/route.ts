/**
 * CSV export for employees directory (authenticated).
 */

import { NextResponse } from "next/server";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchParamFirst } from "@/lib/search-params";
import { rowsToCsv, withUtf8Bom } from "@/lib/csv";
import { buildEmployeeWhere } from "@/lib/queries/employees-list";
import { employeesExportQuerySchema } from "@/lib/validations/export-queries";
import { UserMessage } from "@/lib/user-messages";
import { canExportEmployeesDirectoryCsv } from "@/lib/rbac";
import { auditCsvExportDownload } from "@/lib/audit/record-event";

const EXPORT_CAP = 50_000;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: UserMessage.api.unauthorized }, { status: 401 });
  }
  if (!canExportEmployeesDirectoryCsv(session.user.role)) {
    return NextResponse.json({ error: UserMessage.api.forbidden }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const pick = (k: string) => searchParamFirst(searchParams.get(k) ?? undefined);

  const filters = employeesExportQuerySchema.safeParse({
    role: pick("role"),
    employment: pick("employment"),
    department: pick("department"),
    q: pick("q"),
  });
  if (!filters.success) {
    return NextResponse.json(
      {
        error: filters.error.issues[0]?.message ?? UserMessage.api.invalidExportFilters,
      },
      { status: 400 }
    );
  }

  const { role, employment: empMode, department, q } = filters.data;

  const where = buildEmployeeWhere({
    departmentId: department,
    role,
    employment: empMode,
    q,
  });

  const rows = await prisma.employee.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: EXPORT_CAP,
    include: {
      user: { select: { email: true, role: true } },
      location: { select: { name: true } },
      department: { select: { name: true } },
    },
  });

  const headers = [
    "Code",
    "First name",
    "Last name",
    "Email",
    "Role",
    "Location",
    "Department",
    "Active",
    "Hire date",
  ];
  const data = rows.map((e) => [
    e.employeeCode,
    e.firstName,
    e.lastName,
    e.user.email,
    e.user.role,
    e.location.name,
    e.department?.name ?? "",
    e.isActive ? "yes" : "no",
    format(e.hireDate, "yyyy-MM-dd"),
  ]);

  const csv = withUtf8Bom(rowsToCsv(headers, data));
  const truncated = rows.length >= EXPORT_CAP;

  await auditCsvExportDownload({
    req,
    actor: { id: session.user.id, email: session.user.email },
    exportKind: "employees_csv",
    summary: `Exported employees CSV (${rows.length} rows${truncated ? ", truncated" : ""}).`,
    metadata: { filters: filters.data, rowCount: rows.length, truncated },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees-${new Date().toISOString().slice(0, 10)}.csv"`,
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
}
