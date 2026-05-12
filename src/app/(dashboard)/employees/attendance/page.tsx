/**
 * Attendance log — filters, pagination, CSV export, saved views (browser).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AttendanceStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SavedViewsBar } from "@/components/shared/saved-views-bar";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  searchParamFirst,
  searchParamPage,
  searchParamPageSize,
  toQueryString,
} from "@/lib/search-params";
import {
  addCalendarDaysPrismaDate,
  BUSINESS_TIME_ZONE,
  todayOsloPrismaDate,
} from "@/lib/business-calendar";
import { attendanceLogInclude, buildAttendanceLogWhere } from "@/lib/queries/attendance-log";

export const metadata: Metadata = { title: "Attendance Log" };

const LOOKBACK_DAYS = 90;
const ATT_STATUSES = Object.values(AttendanceStatus);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AttendanceLogPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const selfEmp =
    session.user.role === "STAFF"
      ? await prisma.employee.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })
      : null;
  if (session.user.role === "STAFF" && !selfEmp) {
    redirect("/me");
  }

  const sp = await searchParams;
  const statusRaw = searchParamFirst(sp.status);
  const q = searchParamFirst(sp.q);
  const dateFrom = searchParamFirst(sp.from);
  const dateTo = searchParamFirst(sp.to);
  const page = searchParamPage(sp.page);
  const pageSize = searchParamPageSize(sp.pageSize, 50, 10, 200);

  const status =
    statusRaw && (ATT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as AttendanceStatus)
      : undefined;

  const since = addCalendarDaysPrismaDate(todayOsloPrismaDate(), -LOOKBACK_DAYS);
  const where = buildAttendanceLogWhere({
    since,
    status,
    q: session.user.role === "STAFF" ? undefined : q,
    dateFrom,
    dateTo,
    employeeId: selfEmp?.id,
  });

  const [total, rows] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { employee: { lastName: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: attendanceLogInclude,
    }),
  ]);

  const baseParams: Record<string, string | undefined> = {
    status: statusRaw,
    q,
    from: dateFrom,
    to: dateTo,
    pageSize: String(pageSize),
  };
  const exportQs = toQueryString({
    status: statusRaw,
    q: session.user.role === "STAFF" ? undefined : q,
    from: dateFrom,
    to: dateTo,
  });
  const exportHref = exportQs ? `/api/export/attendance?${exportQs}` : "/api/export/attendance";

  const hasFilters = Boolean(status || (session.user.role !== "STAFF" && q) || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance log"
        description={
          session.user.role === "STAFF"
            ? `Your records · up to ${LOOKBACK_DAYS} days lookback · max ${pageSize} rows per page`
            : `Up to ${LOOKBACK_DAYS} days lookback · server-paginated · max ${pageSize} rows per page`
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={session.user.role === "STAFF" ? "/me" : "/employees"}>
              {session.user.role === "STAFF" ? "My portal" : "Back to employees"}
            </Link>
          </Button>
        }
      />

      <Suspense fallback={null}>
        {session.user.role !== "STAFF" && <SavedViewsBar storageId="attendance-log" />}
      </Suspense>

      <Card className="border-border border shadow-none">
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
            <p className="text-muted-foreground text-xs">
              {hasFilters ? "Filters applied." : "All rows in the lookback window (paginated)."}
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref}>Download CSV (filtered)</a>
            </Button>
          </div>

          <form
            method="get"
            action="/employees/attendance"
            className="border-border bg-muted/15 flex flex-col gap-4 border-b px-4 py-4"
          >
            <div
              className={`grid grid-cols-1 items-end gap-3 sm:grid-cols-2 ${session.user.role === "STAFF" ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}
            >
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Status</Label>
                <NativeSelect
                  name="status"
                  className="w-full max-w-none"
                  defaultValue={status ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All</NativeSelectOption>
                  {ATT_STATUSES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              {session.user.role !== "STAFF" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-muted-foreground text-xs">Employee (name / code)</Label>
                  <Input name="q" defaultValue={q ?? ""} placeholder="Search…" className="h-8" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">From (date)</Label>
                <Input type="date" name="from" defaultValue={dateFrom ?? ""} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">To (date)</Label>
                <Input type="date" name="to" defaultValue={dateTo ?? ""} className="h-8" />
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
                  {[25, 50, 100, 200].map((n) => (
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
                  <Link href="/employees/attendance">Clear</Link>
                </Button>
              </div>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/30 border-b">
                  {[
                    "Date",
                    "Employee",
                    "Code",
                    "Location",
                    "Status",
                    "Check in",
                    "Check out",
                    "Hours",
                    "Notes",
                  ].map((h) => (
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
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-muted-foreground px-4 py-12 text-center text-sm"
                    >
                      {hasFilters
                        ? "No attendance matches these filters."
                        : "No attendance in this period."}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-xs">
                        {r.date.toLocaleDateString("nb-NO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </td>
                      <td className="text-foreground px-4 py-2.5 font-medium">
                        {r.employee.firstName} {r.employee.lastName}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                        {r.employee.employeeCode}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5">
                        {r.employee.location.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-xs">
                        {r.checkIn
                          ? r.checkIn.toLocaleTimeString("nb-NO", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: BUSINESS_TIME_ZONE,
                            })
                          : "—"}
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-xs">
                        {r.checkOut
                          ? r.checkOut.toLocaleTimeString("nb-NO", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: BUSINESS_TIME_ZONE,
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {r.hoursWorked != null
                          ? Number(r.hoursWorked).toLocaleString("nb-NO")
                          : "—"}
                      </td>
                      <td className="text-muted-foreground max-w-[200px] truncate px-4 py-2.5 text-xs">
                        {r.notes ?? "—"}
                      </td>
                    </tr>
                  ))
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
