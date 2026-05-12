"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateMyEmployeeProfile } from "@/lib/actions/employee-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PortalProfileForm({
  phone: initialPhone,
  address: initialAddress,
}: {
  phone: string | null;
  address: string | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSubmitting(true);
    const r = await updateMyEmployeeProfile({ phone, address });
    setSubmitting(false);
    if (!r.success) {
      setError(r.error ?? "Failed");
      return;
    }
    setOk(r.message ?? "Saved");
    router.refresh();
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">My contact details</CardTitle>
        <p className="text-muted-foreground text-xs font-normal">
          You can update phone and address. Other fields are managed by HR.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="max-w-md space-y-4">
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
          <div className="space-y-2">
            <Label htmlFor="portal-phone">Phone</Label>
            <Input
              id="portal-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portal-address">Address</Label>
            <Textarea
              id="portal-address"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
