"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateMyEmployeeProfile } from "@/lib/actions/employee-profile";
import { UserMessage } from "@/lib/user-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PortalProfileForm({
  phone: initialPhone,
  address: initialAddress,
  nationality: initialNationality,
}: {
  phone: string | null;
  address: string | null;
  nationality: string | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [nationality, setNationality] = useState(initialNationality ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSubmitting(true);
    const r = await updateMyEmployeeProfile({ phone, address, nationality });
    setSubmitting(false);
    if (!r.success) {
      setError(r.error ?? UserMessage.error.contactNotSaved);
      return;
    }
    setOk(r.message ?? "Your contact information was saved successfully.");
    router.refresh();
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Contact &amp; nationality</CardTitle>
        <p className="text-muted-foreground text-xs font-normal">
          Update your phone, address, and nationality as registered with the company. Other
          employment details are maintained by Human Resources.
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
            <Label htmlFor="portal-nationality">Nationality</Label>
            <Input
              id="portal-nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              autoComplete="country"
              placeholder="e.g. Norsk / Norwegian"
            />
            <p className="text-muted-foreground text-xs">
              Used for HR records in line with Norwegian employer obligations. Use the nationality
              you declare to the company.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="portal-phone">Phone number</Label>
            <Input
              id="portal-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="e.g. +47 123 45 678"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portal-address">Postal address</Label>
            <Textarea
              id="portal-address"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              placeholder="Street, postal code, city"
            />
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving changes…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
