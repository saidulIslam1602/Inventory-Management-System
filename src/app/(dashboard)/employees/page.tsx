/**
 * Employees page — staff directory with attendance summary and shift view.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, startOfDay } from "date-fns";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const session = await auth();
  const canManage = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const today = startOfDay(new Date());

  const [employees, todayAttendance] = await Promise.all([
    prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        user: { select: { email: true, role: true } },
        location: { select: { name: true } },
        department: { select: { name: true } },
      },
    }),
    prisma.attendance.findMany({
      where: { date: { gte: today } },
      include: { employee: true },
    }),
  ]);

  // Map attendance by employeeId for quick lookup
  const attendanceMap = new Map(todayAttendance.map((a) => [a.employeeId, a]));

  // Department breakdown
  const deptCounts = employees.reduce<Record<string, number>>((acc, emp) => {
    const dept = emp.department?.name ?? "Unassigned";
    acc[dept] = (acc[dept] ?? 0) + 1;
    return acc;
  }, {});

  const presentToday = todayAttendance.filter((a) => a.status === "PRESENT").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={`${employees.filter((e) => e.isActive).length} active staff members`}
        actions={
          canManage && (
            <Button asChild size="sm">
              <Link href="/employees/new">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Employee
              </Link>
            </Button>
          )
        }
      />

      {/* ── Summary Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{employees.filter((e) => e.isActive).length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Active Staff</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{presentToday}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Present Today</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{Object.keys(deptCounts).length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Departments</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-foreground">
            {format(today, "EEE d MMM")}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Today</div>
        </div>
      </div>

      {/* ── Employee Grid ── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Staff Directory
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/employees/attendance">Attendance Log</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Employee", "Code", "Location", "Department", "Role", "Today", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No employees added yet.
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
                              <div className="font-medium text-foreground">
                                {emp.firstName} {emp.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground">{emp.user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">{emp.employeeCode}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.location.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.department?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="capitalize text-xs">
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
                                    : "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
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
                              <Link href={`/employees/${emp.id}`}>View</Link>
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
        </CardContent>
      </Card>
    </div>
  );
}
