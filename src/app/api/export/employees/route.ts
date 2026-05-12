/**
 * CSV export for employees directory (authenticated).
 */

import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchParamFirst } from "@/lib/search-params";
import { rowsToCsv, withUtf8Bom } from "@/lib/csv";
import { USER_ROLES, buildEmployeeWhere } from "@/lib/queries/employees-list";

const EXPORT_CAP = 50_000;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const pick = (k: string) => searchParamFirst(searchParams.get(k) ?? undefined);

  const roleRaw = pick("role");
  const role =
    roleRaw && (USER_ROLES as readonly string[]).includes(roleRaw)
      ? (roleRaw as UserRole)
      : undefined;

  const employment = pick("employment");
  const empMode = employment === "active" || employment === "inactive" ? employment : undefined;

  const where = buildEmployeeWhere({
    departmentId: pick("department"),
    role,
    employment: empMode,
    q: pick("q"),
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

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees-${new Date().toISOString().slice(0, 10)}.csv"`,
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
}
