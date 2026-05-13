"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Flag } from "lucide-react";
import { updateFeatureFlags } from "@/lib/actions/app-settings";
import { UserMessage } from "@/lib/user-messages";
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_DESCRIPTIONS,
  FEATURE_FLAG_LABELS,
  type ResolvedFeatureFlags,
} from "@/lib/feature-flags";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FeatureFlagsForm({ initial }: { initial: ResolvedFeatureFlags }) {
  const router = useRouter();
  const [flags, setFlags] = useState<ResolvedFeatureFlags>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dirty = useMemo(
    () => FEATURE_FLAG_KEYS.some((k) => flags[k] !== initial[k]),
    [flags, initial]
  );

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setPending(true);
    const r = await updateFeatureFlags(flags);
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
          <Flag className="text-primary h-4 w-4" />
          Feature flags
        </CardTitle>
        <CardDescription>
          Turn major modules on or off per deployment (each database/environment has its own
          values). Disabled areas redirect to the dashboard and no longer appear in the sidebar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSave} className="space-y-6">
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
          <div className="divide-border divide-y rounded-md border">
            {FEATURE_FLAG_KEYS.map((key) => (
              <div
                key={key}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <Label htmlFor={`ff-${key}`} className="text-foreground text-sm font-medium">
                    {FEATURE_FLAG_LABELS[key]}
                  </Label>
                  <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
                    {FEATURE_FLAG_DESCRIPTIONS[key]}
                  </p>
                </div>
                <Switch
                  id={`ff-${key}`}
                  checked={flags[key]}
                  onCheckedChange={(checked) =>
                    setFlags((prev) => ({ ...prev, [key]: Boolean(checked) }))
                  }
                  className="data-[state=checked]:bg-primary shrink-0"
                />
              </div>
            ))}
          </div>
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save feature flags"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
