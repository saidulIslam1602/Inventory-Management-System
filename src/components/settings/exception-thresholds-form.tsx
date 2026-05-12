"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateExceptionThresholdSettings } from "@/lib/actions/app-settings";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ExceptionThresholdsForm({
  exceptionStaleSubmitDays,
  exceptionOverdueReceiveDays,
  exceptionMinLowStockBranches,
}: {
  exceptionStaleSubmitDays: number;
  exceptionOverdueReceiveDays: number;
  exceptionMinLowStockBranches: number;
}) {
  const router = useRouter();
  const [stale, setStale] = useState(String(exceptionStaleSubmitDays));
  const [overdue, setOverdue] = useState(String(exceptionOverdueReceiveDays));
  const [branches, setBranches] = useState(String(exceptionMinLowStockBranches));
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setPending(true);
    const r = await updateExceptionThresholdSettings({
      exceptionStaleSubmitDays: Number(stale),
      exceptionOverdueReceiveDays: Number(overdue),
      exceptionMinLowStockBranches: Number(branches),
    });
    setPending(false);
    if (!r.success) {
      setErr(r.error ?? UserMessage.error.generic);
      return;
    }
    setOk(r.message ?? "Settings saved.");
    router.refresh();
  }

  return (
    <Card className="border-border border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Manager hub — exception thresholds
        </CardTitle>
        <CardDescription>
          Tune how the exception queue on <span className="font-mono">/manager</span> flags stale
          approvals, overdue receiving, and multi-branch low stock.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid max-w-lg gap-4">
          {err && (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          {ok && (
            <Alert className="border-success/30 bg-success/8">
              <AlertDescription className="text-foreground">{ok}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="ex-stale">Days in SUBMITTED before “awaiting approval” flag</Label>
            <Input
              id="ex-stale"
              type="number"
              min={1}
              max={30}
              value={stale}
              onChange={(e) => setStale(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ex-overdue">Days before “may be overdue” on receiving pipeline</Label>
            <Input
              id="ex-overdue"
              type="number"
              min={1}
              max={90}
              value={overdue}
              onChange={(e) => setOverdue(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ex-branches">
              Min. branches with low-stock SKUs for multi-branch alert
            </Label>
            <Input
              id="ex-branches"
              type="number"
              min={1}
              max={50}
              value={branches}
              onChange={(e) => setBranches(e.target.value)}
              className="font-mono"
            />
          </div>
          <Button type="submit" size="sm" disabled={pending} className="w-fit">
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save thresholds
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
