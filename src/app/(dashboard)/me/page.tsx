/**
 * Employee portal — self-service hub: attendance, schedule, assignments, branch alerts.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { addDays } from "date-fns";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  addCalendarDaysPrismaDate,
  BUSINESS_TIME_ZONE,
  todayOsloPrismaDate,
} from "@/lib/business-calendar";
import { PortalAttendanceCard } from "@/components/portal/portal-attendance-card";
import { PortalProfileForm } from "@/components/portal/portal-profile-form";
import { PortalNotificationPreferencesForm } from "@/components/portal/portal-notification-preferences-form";
import { PortalNotificationsList } from "@/components/portal/portal-notifications-list";
import { ensureDailyDigestForUser } from "@/lib/notifications/daily-digest";
import {
  wantsDigestDaily,
  wantsEmailDigestDaily,
  wantsInstantPoEvent,
} from "@/lib/notification-preferences";
import { ScanBarcode, LayoutDashboard, FolderKanban, Package, Bell } from "lucide-react";
import { formatQuantityNbNo } from "@/lib/utils";

export const metadata: Metadata = { title: "My portal" };

export default async function EmployeePortalPage() {
  const session = await auth();
  if (!session?.user) return null;

  await ensureDailyDigestForUser(session.user.id);

  const emp = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: {
      location: true,
      department: true,
      user: { select: { email: true, role: true, name: true } },
    },
  });

  const today = todayOsloPrismaDate();
  const weekAgo = addCalendarDaysPrismaDate(today, -7);
  const now = new Date();
  const shiftHorizon = addDays(now, 14);

  const [
    todayAttendance,
    recentAttendance,
    shifts,
    projectRows,
    notifications,
    lowStockRows,
    teamPeers,
    notificationPrefsRow,
  ] = await Promise.all([
    emp
      ? prisma.attendance.findUnique({
          where: { employeeId_date: { employeeId: emp.id, date: today } },
        })
      : Promise.resolve(null),
    emp
      ? prisma.attendance.findMany({
          where: { employeeId: emp.id, date: { gte: weekAgo, lte: today } },
          orderBy: { date: "desc" },
          take: 14,
        })
      : Promise.resolve([]),
    emp
      ? prisma.shift.findMany({
          where: { employeeId: emp.id, startTime: { gte: now, lte: shiftHorizon } },
          orderBy: { startTime: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    emp
      ? prisma.projectEmployee.findMany({
          where: { employeeId: emp.id },
          include: {
            project: {
              select: {
                id: true,
                projectCode: true,
                name: true,
                status: true,
                clientName: true,
                location: { select: { name: true } },
              },
            },
          },
          orderBy: { assignedAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    emp
      ? prisma.$queryRaw<
          Array<{
            productName: string;
            sku: string;
            quantity: unknown;
            reorderPoint: unknown;
            symbol: string;
          }>
        >`
            SELECT p.name as "productName", p.sku,
                   s.quantity, s."reorderPoint", u.symbol
            FROM stock s
            JOIN products p ON s."productId" = p.id
            JOIN units u ON p."unitId" = u.id
            WHERE s."locationId" = ${emp.locationId}
              AND s.quantity <= s."reorderPoint" AND s."reorderPoint" > 0
            ORDER BY s.quantity ASC
            LIMIT 8
          `
      : Promise.resolve([]),
    emp && (session.user.role === UserRole.MANAGER || session.user.role === UserRole.ADMIN)
      ? prisma.employee.findMany({
          where: {
            locationId: emp.locationId,
            isActive: true,
            id: { not: emp.id },
          },
          take: 25,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        })
      : Promise.resolve([]),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPreferences: true },
    }),
  ]);

  const teamAttendance =
    emp && teamPeers.length > 0
      ? await prisma.attendance.findMany({
          where: {
            date: today,
            employeeId: { in: teamPeers.map((p) => p.id) },
          },
        })
      : [];
  const attByEmp = new Map(teamAttendance.map((a) => [a.employeeId, a]));

  const showOpsCards =
    session.user.role === UserRole.STAFF ||
    session.user.role === UserRole.MANAGER ||
    session.user.role === UserRole.ADMIN;

  return (
    <div className="space-y-8">
      <PageHeader
        title={emp ? `Hi, ${emp.firstName}` : "My portal"}
        description={
          emp
            ? `${emp.employeeCode} · ${emp.location.name}${
                emp.department ? ` · ${emp.department.name}` : ""
              } · ${emp.user.email}`
            : "Your account is not linked to an employee profile. Use the main dashboard and settings, or contact HR."
        }
      />

      {!emp && (
        <Card className="border-warning/35 bg-warning/10 shadow-sm">
          <CardContent className="text-foreground py-5 text-sm sm:py-6">
            <p className="mb-2 font-medium">No employee record</p>
            <p className="text-muted-foreground mb-3">
              Check-in, schedule, and “my branch” features need a linked employee profile (normal
              for some admin accounts).
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Open dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {emp && showOpsCards && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PortalAttendanceCard
            todayAttendance={
              todayAttendance
                ? {
                    checkIn: todayAttendance.checkIn,
                    checkOut: todayAttendance.checkOut,
                    status: todayAttendance.status,
                    hoursWorked: todayAttendance.hoursWorked,
                  }
                : null
            }
          />
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Quick actions</CardTitle>
              <p className="text-muted-foreground text-xs font-normal">
                Common tasks from your portal
              </p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <Button
                asChild
                variant="outline"
                className="h-auto min-h-11 justify-start gap-2 py-2.5"
              >
                <Link href="/inventory/receive">
                  <ScanBarcode className="text-primary h-4 w-4 shrink-0" />
                  <span className="text-left leading-snug">Receive goods (scan)</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-auto min-h-11 justify-start gap-2 py-2.5"
              >
                <Link href="/inventory">
                  <Package className="text-primary h-4 w-4 shrink-0" />
                  <span className="text-left leading-snug">Inventory</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-auto min-h-11 justify-start gap-2 py-2.5"
              >
                <Link href="/projects">
                  <FolderKanban className="text-primary h-4 w-4 shrink-0" />
                  <span className="text-left leading-snug">Projects</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-auto min-h-11 justify-start py-2.5 sm:col-span-2"
              >
                <Link href="/employees/attendance">My attendance history</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {emp && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Upcoming shifts</CardTitle>
              <p className="text-muted-foreground text-xs font-normal">Next 14 days</p>
            </CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No shifts scheduled in this window.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {shifts.map((s) => (
                    <li
                      key={s.id}
                      className="border-border/60 flex flex-col border-b pb-2 last:border-0 last:pb-0"
                    >
                      <span className="font-medium">
                        {s.startTime.toLocaleString("nb-NO", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: BUSINESS_TIME_ZONE,
                        })}{" "}
                        –{" "}
                        {s.endTime.toLocaleString("nb-NO", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: BUSINESS_TIME_ZONE,
                        })}
                      </span>
                      {s.title && <span className="text-muted-foreground text-xs">{s.title}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Recent attendance</CardTitle>
              <p className="text-muted-foreground text-xs font-normal">Last 7 days (Oslo dates)</p>
            </CardHeader>
            <CardContent>
              {recentAttendance.length === 0 ? (
                <p className="text-muted-foreground text-sm">No rows yet.</p>
              ) : (
                <ul className="divide-border/80 space-y-0 divide-y text-sm">
                  {recentAttendance.map((a) => (
                    <li
                      key={a.id}
                      className="grid grid-cols-1 items-center gap-2 py-2.5 first:pt-0 sm:grid-cols-[minmax(0,5.5rem)_auto_minmax(0,1fr)] sm:gap-3"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {a.date.toLocaleDateString("nb-NO", {
                          timeZone: "UTC",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <div className="sm:justify-self-start">
                        <StatusBadge status={a.status} />
                      </div>
                      <span className="text-muted-foreground font-mono text-xs sm:text-right">
                        {a.checkIn
                          ? a.checkIn.toLocaleTimeString("nb-NO", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: BUSINESS_TIME_ZONE,
                            })
                          : "—"}{" "}
                        /{" "}
                        {a.checkOut
                          ? a.checkOut.toLocaleTimeString("nb-NO", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: BUSINESS_TIME_ZONE,
                            })
                          : !a.checkIn
                            ? "—"
                            : "open"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {emp && projectRows.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">My project assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {projectRows.map((row) => (
                <li
                  key={row.projectId}
                  className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link
                      href={`/projects/${row.project.id}`}
                      className="text-foreground hover:text-primary text-sm font-medium"
                    >
                      {row.project.name}
                    </Link>
                    <div className="text-muted-foreground font-mono text-xs">
                      {row.project.projectCode}
                      {row.role ? ` · ${row.role}` : ""} · {row.project.location.name}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={row.project.status} />
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/projects/${row.project.id}`}>Open</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {emp && lowStockRows.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Low stock at {emp.location.name}
            </CardTitle>
            <p className="text-muted-foreground text-xs font-normal">
              Same branch as your home location
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {lowStockRows.map((r, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    <span className="font-medium">{r.productName}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-xs">{r.sku}</span>
                  </span>
                  <span className="text-warning-foreground whitespace-nowrap font-mono">
                    {formatQuantityNbNo(Number(r.quantity), r.symbol)} / min{" "}
                    {formatQuantityNbNo(Number(r.reorderPoint), r.symbol)} {r.symbol}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {emp && teamPeers.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Team at {emp.location.name} today
            </CardTitle>
            <p className="text-muted-foreground text-xs font-normal">
              Managers & admins: snapshot for your branch
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2">Today</th>
                </tr>
              </thead>
              <tbody>
                {teamPeers.map((p) => {
                  const a = attByEmp.get(p.id);
                  return (
                    <tr key={p.id} className="border-border/60 border-b">
                      <td className="py-2 pr-4">
                        {p.firstName} {p.lastName}
                      </td>
                      <td className="text-muted-foreground py-2 pr-4 font-mono text-xs">
                        {p.employeeCode}
                      </td>
                      <td className="py-2">
                        {a ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={a.status} />
                            {a.checkIn && (
                              <span className="text-muted-foreground text-xs">
                                in{" "}
                                {a.checkIn.toLocaleTimeString("nb-NO", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: BUSINESS_TIME_ZONE,
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">No row yet</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <PortalNotificationPreferencesForm
        initial={{
          poSubmitted: wantsInstantPoEvent(
            notificationPrefsRow?.notificationPreferences,
            "poSubmitted"
          ),
          poApproved: wantsInstantPoEvent(
            notificationPrefsRow?.notificationPreferences,
            "poApproved"
          ),
          poOrdered: wantsInstantPoEvent(
            notificationPrefsRow?.notificationPreferences,
            "poOrdered"
          ),
          poReceived: wantsInstantPoEvent(
            notificationPrefsRow?.notificationPreferences,
            "poReceived"
          ),
          digestDaily: wantsDigestDaily(notificationPrefsRow?.notificationPreferences),
          emailDigestDaily: wantsEmailDigestDaily(notificationPrefsRow?.notificationPreferences),
        }}
      />

      <Card id="portal-notifications" className="scroll-mt-24 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
              <Bell className="text-primary h-4 w-4" />
            </span>
            Notifications for you
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PortalNotificationsList
            items={notifications.map((n) => ({
              id: n.id,
              title: n.title,
              message: n.message,
              isRead: n.isRead,
              createdAt: n.createdAt.toISOString(),
              actionHref: n.actionHref ?? null,
              type: n.type,
            }))}
          />
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-muted/20 border-dashed shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Time off</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm leading-relaxed">
          Leave and sickness registration with approval is not in the app yet. Please contact your
          manager or HR so they can record it in the attendance log.
        </CardContent>
      </Card>

      {emp && showOpsCards && <PortalProfileForm phone={emp.phone} address={emp.address} />}
    </div>
  );
}
