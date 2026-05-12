/**
 * Employees page — staff directory with filters, pagination, CSV export, saved views.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Users } from "lucide-react";
import { UserRole, AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { SavedViewsBar } from "@/components/shared/saved-views-bar";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  searchParamFirst,
  searchParamPage,
  searchParamPageSize,
  toQueryString,
} from "@/lib/search-params";
import { BUSINESS_TIME_ZONE, todayOsloPrismaDate } from "@/lib/business-calendar";
import { EMPLOYEE_NO_DEPT, USER_ROLES, buildEmployeeWhere } from "@/lib/queries/employees-list";

export const metadata: Metadata = { title: "Employees" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmployeesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user?.role === "STAFF") {
    redirect("/me");
  }

  const canManage = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const sp = await searchParams;
  const departmentIdParam = searchParamFirst(sp.department);
  const roleRaw = searchParamFirst(sp.role);
  const employment = searchParamFirst(sp.employment);
  const q = searchParamFirst(sp.q);
  const page = searchParamPage(sp.page);
  const pageSize = searchParamPageSize(sp.pageSize, 25, 10, 100);

  const role =
    roleRaw && (USER_ROLES as readonly string[]).includes(roleRaw)
      ? (roleRaw as UserRole)
      : undefined;

  const empMode = employment === "active" || employment === "inactive" ? employment : undefined;

  const empWhere = buildEmployeeWhere({
    departmentId: departmentIdParam,
    role,
    employment: empMode,
    q,
  });

  const todayOslo = todayOsloPrismaDate();

  const [total, activeTotal, presentToday, deptGroups, employees, departments] = await Promise.all([
    prisma.employee.count({ where: empWhere }),
    prisma.employee.count({ where: { ...empWhere, isActive: true } }),
    prisma.attendance.count({
      where: {
        date: { equals: todayOslo },
        status: AttendanceStatus.PRESENT,
        employee: empWhere,
      },
    }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: empWhere,
      _count: { _all: true },
    }),
    prisma.employee.findMany({
      where: empWhere,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { email: true, role: true } },
        location: { select: { name: true } },
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
  const deptCounts = deptGroups.reduce<Record<string, number>>((acc, g) => {
    const label = g.departmentId
      ? (deptNameById.get(g.departmentId) ?? "Department")
      : "Unassigned";
    acc[label] = (acc[label] ?? 0) + g._count._all;
    return acc;
  }, {});

  const attendanceRows = await prisma.attendance.findMany({
    where: {
      date: { equals: todayOslo },
      employeeId: { in: employees.map((e) => e.id) },
    },
  });
  const attendanceMap = new Map(attendanceRows.map((a) => [a.employeeId, a]));

  const hasFilters = Boolean(departmentIdParam || role || employment || q);

  const baseParams: Record<string, string | undefined> = {
    department: departmentIdParam,
    role: roleRaw,
    employment,
    q,
    pageSize: String(pageSize),
  };

  const exportQs = toQueryString({
    department: departmentIdParam,
    role: roleRaw,
    employment,
    q,
  });
  const exportHref = exportQs ? `/api/export/employees?${exportQs}` : "/api/export/employees";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={`${activeTotal.toLocaleString("nb-NO")} active · ${total.toLocaleString("nb-NO")} match list filters`}
        actions={
          canManage && (
            <Button asChild size="sm">
              <Link href="/employees/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Employee
              </Link>
            </Button>
          )
        }
      />

      <Suspense fallback={null}>
        <SavedViewsBar storageId="employees" />
      </Suspense>

      <Card className="border-border border shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-wrap justify-end gap-2 px-4 pt-4">
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref}>Download CSV (filtered)</a>
            </Button>
          </div>
          <form
            method="get"
            action="/employees"
            className="border-border bg-muted/15 flex flex-col gap-3 border-b px-4 py-4"
          >
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Department</Label>
                <NativeSelect
                  name="department"
                  className="w-full max-w-none"
                  defaultValue={departmentIdParam ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All departments</NativeSelectOption>
                  <NativeSelectOption value={EMPLOYEE_NO_DEPT}>Unassigned</NativeSelectOption>
                  {departments.map((d) => (
                    <NativeSelectOption key={d.id} value={d.id}>
                      {d.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Role</Label>
                <NativeSelect
                  name="role"
                  className="w-full max-w-none"
                  defaultValue={roleRaw ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All roles</NativeSelectOption>
                  {USER_ROLES.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, " ")}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Employment</Label>
                <NativeSelect
                  name="employment"
                  className="w-full max-w-none"
                  defaultValue={employment ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All</NativeSelectOption>
                  <NativeSelectOption value="active">Active only</NativeSelectOption>
                  <NativeSelectOption value="inactive">Inactive only</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-muted-foreground text-xs">Search name, code, email</Label>
                <Input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Ola, AQ-0042, @aqila…"
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Rows per page</Label>
                <NativeSelect
                  name="pageSize"
                  className="w-full max-w-none"
                  defaultValue={String(pageSize)}
                  size="sm"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <NativeSelectOption key={n} value={String(n)}>
                      {n}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm">
                  Apply
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/employees">Clear</Link>
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="border-border bg-card rounded-lg border p-4 text-center">
          <div className="text-foreground text-2xl font-bold">{activeTotal}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">Active (filtered)</div>
        </div>
        <div className="border-border bg-card rounded-lg border p-4 text-center">
          <div className="text-primary text-2xl font-bold">{presentToday}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">Present today (filtered)</div>
        </div>
        <div className="border-border bg-card rounded-lg border p-4 text-center">
          <div className="text-foreground text-2xl font-bold">{Object.keys(deptCounts).length}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">Dept groups</div>
        </div>
        <div className="border-border bg-card rounded-lg border p-4 text-center">
          <div className="text-foreground text-2xl font-bold">
            {new Date().toLocaleDateString("nb-NO", {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: BUSINESS_TIME_ZONE,
            })}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">Today</div>
        </div>
      </div>

      <Card className="border-border border shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="text-primary h-4 w-4" />
            Staff directory
            {hasFilters && (
              <span className="text-muted-foreground text-xs font-normal">· filtered</span>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/employees/attendance">Attendance Log</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/30 border-b">
                  {["Employee", "Code", "Location", "Department", "Role", "Today", ""].map((h) => (
                    <th
                      key={h}
                      className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground px-4 py-12 text-center text-sm"
                    >
                      {hasFilters ? "No employees match these filters." : "No employees added yet."}
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const att = attendanceMap.get(emp.id);
                    const initials = `${emp.firstName[0]}${emp.lastName[0]}`.toUpperCase();

                    return (
                      <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-foreground font-medium">
                                {emp.firstName} {emp.lastName}
                              </div>
                              <div className="text-muted-foreground text-xs">{emp.user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground font-mono text-xs">
                            {emp.employeeCode}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-4 py-3">{emp.location.name}</td>
                        <td className="text-muted-foreground px-4 py-3">
                          {emp.department?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {emp.user.role.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {att ? (
                            <Badge
                              variant="outline"
                              className={
                                att.status === "PRESENT"
                                  ? "bg-primary/10 text-primary border-primary/20 text-xs"
                                  : att.status === "ABSENT"
                                    ? "bg-destructive/10 text-destructive border-destructive/20 text-xs"
                                    : "border-yellow-200 bg-yellow-50 text-xs text-yellow-700"
                              }
                            >
                              {att.status.charAt(0) + att.status.slice(1).toLowerCase()}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Not recorded</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canManage && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/employees/${emp.id}`}>Edit</Link>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <ListPagination page={page} pageSize={pageSize} total={total} baseParams={baseParams} />
        </CardContent>
      </Card>
    </div>
  );
}
