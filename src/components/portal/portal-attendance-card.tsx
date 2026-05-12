"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, LogOut, Clock } from "lucide-react";
import { checkInAttendance, checkOutAttendance } from "@/lib/actions/attendance";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";
import { cn } from "@/lib/utils";

type TodayAttendance = {
  checkIn: Date | null;
  checkOut: Date | null;
  status: string;
  hoursWorked: { toString: () => string } | number | string | null;
};

export function PortalAttendanceCard({
  todayAttendance,
}: {
  todayAttendance: TodayAttendance | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const hasIn = Boolean(todayAttendance?.checkIn);
  const hasOut = Boolean(todayAttendance?.checkOut);

  const statusMeta = hasOut
    ? {
        label: "Finished for today",
        dot: "bg-muted-foreground",
        tone: "text-muted-foreground" as const,
      }
    : hasIn
      ? { label: "You are checked in", dot: "bg-success", tone: "text-success" as const }
      : {
          label: "Not checked in yet",
          dot: "bg-warning",
          tone: "text-warning-foreground" as const,
        };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Today — check in / out</CardTitle>
            <p className="text-muted-foreground text-xs font-normal">
              Times use Europe/Oslo (
              {new Date().toLocaleDateString("nb-NO", {
                timeZone: BUSINESS_TIME_ZONE,
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              )
            </p>
          </div>
          <div
            className="border-border/80 bg-muted/30 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
            role="status"
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", statusMeta.dot)} aria-hidden />
            <span className={cn("leading-none", statusMeta.tone)}>{statusMeta.label}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {ok && (
          <Alert className="border-success/30 bg-success/8">
            <AlertDescription className="text-foreground">{ok}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="border-border/80 bg-muted/25 flex gap-3 rounded-xl border px-3 py-3">
            <div className="bg-background ring-border/60 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1">
              <LogIn className="text-primary h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground text-xs">Check in</div>
              <div className="text-foreground mt-0.5 font-medium tabular-nums">
                {todayAttendance?.checkIn
                  ? todayAttendance.checkIn.toLocaleString("nb-NO", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      timeZone: BUSINESS_TIME_ZONE,
                    })
                  : "—"}
              </div>
            </div>
          </div>
          <div className="border-border/80 bg-muted/25 flex gap-3 rounded-xl border px-3 py-3">
            <div className="bg-background ring-border/60 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1">
              <LogOut className="text-muted-foreground h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground text-xs">Check out</div>
              <div className="text-foreground mt-0.5 font-medium tabular-nums">
                {todayAttendance?.checkOut
                  ? todayAttendance.checkOut.toLocaleString("nb-NO", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      timeZone: BUSINESS_TIME_ZONE,
                    })
                  : "—"}
              </div>
            </div>
          </div>
        </div>
        {hasIn &&
          todayAttendance?.hoursWorked != null &&
          Number(todayAttendance.hoursWorked) > 0 && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Hours today:{" "}
                <span className="text-foreground font-mono font-medium">
                  {Number(todayAttendance.hoursWorked).toFixed(2)}
                </span>{" "}
                h
              </span>
            </p>
          )}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            className="w-full sm:w-auto sm:min-w-[10rem]"
            disabled={pending || hasIn}
            onClick={() => {
              setError(null);
              setOk(null);
              start(async () => {
                const r = await checkInAttendance();
                if (!r.success) setError(r.error ?? UserMessage.error.generic);
                else {
                  setOk(r.message ?? "You are checked in.");
                  router.refresh();
                }
              });
            }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            <span className="ml-2">Check in</span>
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto sm:min-w-[10rem]"
            variant="outline"
            disabled={pending || !hasIn || hasOut}
            onClick={() => {
              setError(null);
              setOk(null);
              start(async () => {
                const r = await checkOutAttendance();
                if (!r.success) setError(r.error ?? UserMessage.error.generic);
                else {
                  setOk(r.message ?? "You are checked out.");
                  router.refresh();
                }
              });
            }}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span className="ml-2">Check out</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
