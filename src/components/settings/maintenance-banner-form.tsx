"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Megaphone } from "lucide-react";
import { updateMaintenanceBannerSettings } from "@/lib/actions/app-settings";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type MaintenanceBannerFormInitial = {
  maintenanceBannerEnabled: boolean;
  maintenanceBannerMessage: string;
  /** ISO timestamp or empty when unset */
  maintenanceBannerStartsAt: string;
  maintenanceBannerEndsAt: string;
};

function isoToDatetimeLocal(iso: string): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string {
  if (!local.trim()) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function normalizedPayload(p: {
  enabled: boolean;
  message: string;
  startsLocal: string;
  endsLocal: string;
}) {
  return JSON.stringify({
    enabled: p.enabled,
    message: p.message,
    starts: datetimeLocalToIso(p.startsLocal),
    ends: datetimeLocalToIso(p.endsLocal),
  });
}

export function MaintenanceBannerForm({ initial }: { initial: MaintenanceBannerFormInitial }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.maintenanceBannerEnabled);
  const [message, setMessage] = useState(initial.maintenanceBannerMessage);
  const [startsLocal, setStartsLocal] = useState(() =>
    isoToDatetimeLocal(initial.maintenanceBannerStartsAt)
  );
  const [endsLocal, setEndsLocal] = useState(() =>
    isoToDatetimeLocal(initial.maintenanceBannerEndsAt)
  );
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dirty = useMemo(() => {
    const cur = normalizedPayload({ enabled, message, startsLocal, endsLocal });
    const ini = normalizedPayload({
      enabled: initial.maintenanceBannerEnabled,
      message: initial.maintenanceBannerMessage,
      startsLocal: isoToDatetimeLocal(initial.maintenanceBannerStartsAt),
      endsLocal: isoToDatetimeLocal(initial.maintenanceBannerEndsAt),
    });
    return cur !== ini;
  }, [
    enabled,
    message,
    startsLocal,
    endsLocal,
    initial.maintenanceBannerEnabled,
    initial.maintenanceBannerMessage,
    initial.maintenanceBannerStartsAt,
    initial.maintenanceBannerEndsAt,
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setPending(true);
    const r = await updateMaintenanceBannerSettings({
      maintenanceBannerEnabled: enabled,
      maintenanceBannerMessage: message,
      maintenanceBannerStartsAt: datetimeLocalToIso(startsLocal),
      maintenanceBannerEndsAt: datetimeLocalToIso(endsLocal),
    });
    setPending(false);
    if (!r.success) {
      setErr(r.error ?? UserMessage.error.generic);
      return;
    }
    setOk(r.message ?? "Saved.");
    router.refresh();
  }

  return (
    <Card className="border-border border shadow-none lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Megaphone className="text-primary h-4 w-4" />
          Maintenance window banner
        </CardTitle>
        <CardDescription>
          Show a notice bar during planned downtime. Optionally restrict visibility to a start/end
          window (times use this browser&apos;s local timezone). Leave dates empty to show whenever
          the banner is enabled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
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
          <div className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="mb-enabled">Banner visible</Label>
              <p className="text-muted-foreground text-xs">
                When on (and message set), users see the bar on sign-in and inside the app.
              </p>
            </div>
            <Switch
              id="mb-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              className="data-[state=checked]:bg-primary shrink-0"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mb-msg">Message</Label>
            <Textarea
              id="mb-msg"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Planned maintenance tonight from 22:00–23:00. Receipt posting may be delayed."
              maxLength={500}
              className="min-h-[5rem] resize-y"
            />
            <p className="text-muted-foreground text-xs">{message.length} / 500</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mb-start">Show from (optional)</Label>
              <Input
                id="mb-start"
                type="datetime-local"
                value={startsLocal}
                onChange={(e) => setStartsLocal(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mb-end">Hide after (optional)</Label>
              <Input
                id="mb-end"
                type="datetime-local"
                value={endsLocal}
                onChange={(e) => setEndsLocal(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save banner"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
