import Link from "next/link";
import {
  AlarmClock,
  ArrowDownCircle,
  Bell,
  ClipboardList,
  LogIn,
  Package,
  SunMedium,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";

export type PortalStaffTodayHeroProps = {
  firstName: string;
  locationName: string;
  /** Oslo calendar day label, already localized (weekday included) */
  todayLabel: string;
  attendance: {
    checkIn: Date | null;
    checkOut: Date | null;
    hoursWorked: number | null;
  } | null;
  nextShift: { startTime: Date; endTime: Date; title: string | null } | null;
  /** POs awaiting goods-in at the employee branch */
  inboundPurchaseOrdersCount: number;
  unreadNotificationsCount: number;
  activeProjectAssignmentsCount: number;
};

function formatHm(d: Date) {
  return d.toLocaleString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  });
}

export function PortalStaffTodayHero(props: PortalStaffTodayHeroProps) {
  const {
    firstName,
    locationName,
    todayLabel,
    attendance,
    nextShift,
    inboundPurchaseOrdersCount,
    unreadNotificationsCount,
    activeProjectAssignmentsCount,
  } = props;

  const hasIn = Boolean(attendance?.checkIn);
  const hasOut = Boolean(attendance?.checkOut);
  let attendancePhrase: string;
  if (!hasIn) attendancePhrase = "You have not checked in today.";
  else if (!hasOut)
    attendancePhrase = `Checked in at ${formatHm(attendance!.checkIn!)} — remember to check out.`;
  else {
    const h =
      attendance!.hoursWorked != null && Number(attendance!.hoursWorked) > 0
        ? `${Number(attendance!.hoursWorked).toFixed(1)} h logged`
        : "shift recorded";
    attendancePhrase = `Checked out — ${h}.`;
  }

  const shiftPhrase = nextShift
    ? `${formatHm(nextShift.startTime)}–${formatHm(nextShift.endTime)}${
        nextShift.title ? ` · ${nextShift.title}` : ""
      }`
    : null;

  return (
    <Card className="from-primary/8 border-primary/15 to-card ring-primary/10 bg-gradient-to-br shadow-sm ring-1">
      <CardContent className="pb-6 pt-6 sm:pb-8 sm:pt-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 lg:max-w-xl">
            <div className="text-primary flex items-center gap-2 text-sm font-medium">
              <SunMedium className="h-4 w-4 shrink-0" aria-hidden />
              Today at {locationName}
            </div>
            <div>
              <h2 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
                Hi {firstName} — ready for today
              </h2>
              <p className="text-muted-foreground mt-1 text-sm capitalize">{todayLabel}</p>
            </div>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li className="flex gap-2">
                <LogIn className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{attendancePhrase}</span>
              </li>
              {shiftPhrase && (
                <li className="flex gap-2">
                  <AlarmClock className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Next shift: <span className="text-foreground font-medium">{shiftPhrase}</span>
                  </span>
                </li>
              )}
              {inboundPurchaseOrdersCount > 0 && (
                <li className="flex gap-2">
                  <Package className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    <span className="text-foreground font-medium">
                      {inboundPurchaseOrdersCount}
                    </span>{" "}
                    purchase order{inboundPurchaseOrdersCount === 1 ? "" : "s"} inbound to your
                    branch — receiving may be needed.
                  </span>
                </li>
              )}
              {activeProjectAssignmentsCount > 0 && (
                <li className="flex gap-2">
                  <ClipboardList className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    <span className="text-foreground font-medium">
                      {activeProjectAssignmentsCount}
                    </span>{" "}
                    active project assignment{activeProjectAssignmentsCount === 1 ? "" : "s"} on
                    your list.
                  </span>
                </li>
              )}
              {unreadNotificationsCount > 0 && (
                <li className="flex gap-2">
                  <Bell className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    <span className="text-foreground font-medium">{unreadNotificationsCount}</span>{" "}
                    unread notification{unreadNotificationsCount === 1 ? "" : "s"}.
                  </span>
                </li>
              )}
            </ul>
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch xl:min-w-[14rem]"
            )}
          >
            <Button asChild variant="outline" size="lg" className="h-12 min-h-11 justify-between">
              <Link href="/inventory/receive#receive-po-wizard">
                <span className="flex items-center gap-2">
                  <ArrowDownCircle className="text-primary h-4 w-4" aria-hidden />
                  Receive vs PO
                </span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 min-h-11 justify-between">
              <Link href="#portal-check-in">Check in / out</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 min-h-11 justify-between">
              <Link href="#portal-notifications">Notifications</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
