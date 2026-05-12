"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateMyNotificationPreferences } from "@/lib/actions/notification-preferences";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PortalNotificationPreferencesForm({
  initial,
}: {
  initial: {
    poSubmitted: boolean;
    poApproved: boolean;
    poOrdered: boolean;
    poReceived: boolean;
    digestDaily: boolean;
    emailDigestDaily: boolean;
  };
}) {
  const router = useRouter();
  const [poSubmitted, setPoSubmitted] = useState(initial.poSubmitted);
  const [poApproved, setPoApproved] = useState(initial.poApproved);
  const [poOrdered, setPoOrdered] = useState(initial.poOrdered);
  const [poReceived, setPoReceived] = useState(initial.poReceived);
  const [digestDaily, setDigestDaily] = useState(initial.digestDaily);
  const [emailDigestDaily, setEmailDigestDaily] = useState(initial.emailDigestDaily);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setPending(true);
    const r = await updateMyNotificationPreferences({
      instant: {
        poSubmitted,
        poApproved,
        poOrdered,
        poReceived,
      },
      digestDaily,
      emailDigestDaily,
    });
    setPending(false);
    if (!r.success) {
      setErr(r.error ?? UserMessage.error.generic);
      return;
    }
    setOk(r.message ?? "Preferences saved.");
    router.refresh();
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Notification preferences</CardTitle>
        <p className="text-muted-foreground text-xs font-normal leading-relaxed">
          Choose instant in-app alerts for purchase order events. You can also add a daily ops
          digest (snapshot of exceptions and activity) — at most about once per day when you open
          this portal.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="max-w-md space-y-4">
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
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Instant — purchase orders
          </p>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox
                checked={poSubmitted}
                onCheckedChange={(v) => setPoSubmitted(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Submitted</span>
                <span className="text-muted-foreground block text-xs">
                  When a PO is sent for approval (managers / admins).
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox
                checked={poApproved}
                onCheckedChange={(v) => setPoApproved(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Approved</span>
                <span className="text-muted-foreground block text-xs">
                  Ready to place with the supplier.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox
                checked={poOrdered}
                onCheckedChange={(v) => setPoOrdered(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Ordered</span>
                <span className="text-muted-foreground block text-xs">
                  Marked as ordered with the supplier.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox
                checked={poReceived}
                onCheckedChange={(v) => setPoReceived(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Received</span>
                <span className="text-muted-foreground block text-xs">
                  When goods are posted in — full or partial receipt.
                </span>
              </span>
            </label>
          </div>
          <div className="border-border/60 border-t pt-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox
                checked={digestDaily}
                onCheckedChange={(v) => setDigestDaily(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Daily digest</span>
                <span className="text-muted-foreground block text-xs">
                  One summary notification with PO queue size, recent movement count, and top
                  exception titles when you visit this page.
                </span>
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox
                checked={emailDigestDaily}
                onCheckedChange={(v) => setEmailDigestDaily(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Email daily digest</span>
                <span className="text-muted-foreground block text-xs">
                  Same snapshot as above, sent once per day to your account email when SMTP is
                  configured (scheduled server job — see ops runbook / CRON_SECRET).
                </span>
              </span>
            </label>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save preferences
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
