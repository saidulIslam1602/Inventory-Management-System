/**
 * Unified profile — employer context, employment facts, photo, self-service contact & nationality.
 * Available to all authenticated roles; users without an employee record see account + org context only.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalProfileForm } from "@/components/portal/portal-profile-form";
import { Building2, Flag, LayoutDashboard, MapPin } from "lucide-react";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";

export const metadata: Metadata = { title: "Profile" };

function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/profile");

  const emp = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: {
      location: true,
      department: true,
      user: { select: { email: true, name: true, role: true } },
    },
  });

  const displayName =
    emp != null ? `${emp.firstName} ${emp.lastName}`.trim() : (session.user.name ?? "User");
  const initials = initialsFromName(displayName);
  const hireFormatted =
    emp != null
      ? emp.hireDate.toLocaleDateString("nb-NO", {
          timeZone: BUSINESS_TIME_ZONE,
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profile"
        description={
          emp
            ? "Your information on file with Aqila — workplace, contact details, and nationality."
            : "Your account details. Some fields appear when your login is linked to an employee profile."
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border shadow-sm lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">You</CardTitle>
            <CardDescription>How you appear in Aqila IMS</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
            {emp?.photoUrl ? (
              <div className="bg-muted ring-border relative h-28 w-28 shrink-0 overflow-hidden rounded-full ring-2">
                {/* Use img when URL may be outside image remotePatterns */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={emp.photoUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="bg-primary text-primary-foreground ring-border flex h-28 w-28 shrink-0 items-center justify-center rounded-full text-2xl font-semibold ring-2">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-foreground text-lg font-semibold leading-tight">{displayName}</p>
              <p className="text-muted-foreground break-all text-sm">{session.user.email}</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {session.user.role.toLowerCase()}
              </Badge>
              {emp && (
                <p className="text-muted-foreground pt-2 font-mono text-xs">{emp.employeeCode}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-2">
              <Building2 className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <CardTitle className="text-base font-semibold">Employer</CardTitle>
                <CardDescription>Company context (Norway)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-foreground font-medium">Aqila AS</p>
              <p className="text-muted-foreground mt-1 leading-relaxed">
                Internal inventory &amp; operations platform for branches across Lofoten. Registered
                activity and HR master data follow Norwegian rules for employers.
              </p>
            </div>
            {emp ? (
              <dl className="border-border/60 grid gap-3 border-t pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground flex items-center gap-1 text-xs font-medium uppercase tracking-wide">
                    <MapPin className="h-3 w-3" aria-hidden />
                    Primary workplace
                  </dt>
                  <dd className="text-foreground mt-1 font-medium">{emp.location.name}</dd>
                  {emp.location.address && (
                    <dd className="text-muted-foreground mt-0.5 text-xs">{emp.location.address}</dd>
                  )}
                  {emp.location.phone && (
                    <dd className="text-muted-foreground text-xs">Tel. {emp.location.phone}</dd>
                  )}
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Department
                  </dt>
                  <dd className="text-foreground mt-1 font-medium">
                    {emp.department?.name ?? "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted-foreground border-border/60 border-t pt-4 text-xs leading-relaxed">
                Your user is not linked to an employee file (common for some admin or service
                accounts). Workplace and employment sections stay hidden until HR links a profile.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {emp && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Employment details</CardTitle>
              <CardDescription>Maintained by HR — contact them for corrections</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <div className="border-border/60 flex justify-between gap-4 border-b py-2">
                  <dt className="text-muted-foreground">Hire date</dt>
                  <dd className="text-foreground font-medium tabular-nums">{hireFormatted}</dd>
                </div>
                <div className="border-border/60 flex justify-between gap-4 border-b py-2">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="text-foreground font-medium">
                    {emp.isActive ? "Active" : "Inactive"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">Work email</dt>
                  <dd className="text-foreground max-w-[60%] truncate break-all text-right font-medium">
                    {emp.user.email}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-2">
                <Flag className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <CardTitle className="text-base font-semibold">
                    Norway &amp; personal data
                  </CardTitle>
                  <CardDescription>Nationality and statutory context</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
              <p>
                <span className="text-foreground font-medium">Registered nationality: </span>
                {emp.nationality?.trim() ? emp.nationality : "— (add below if missing)"}
              </p>
              <p>
                Employment and payroll in Norway are subject to the Working Environment Act, tax
                reporting, and national insurance. Sensitive identifiers (for example national ID)
                are <strong className="text-foreground font-medium">not</strong> stored in this app
                — HR maintains those records under GDPR / personvernreglene.
              </p>
              <p className="text-xs">
                Primary locale for dates and times in the portal:{" "}
                <span className="text-foreground font-medium">nb-NO</span> / {BUSINESS_TIME_ZONE}.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {emp && (
        <div className="space-y-4">
          <PortalProfileForm
            phone={emp.phone}
            address={emp.address}
            nationality={emp.nationality}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/me">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                My portal (schedule &amp; attendance)
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/change-password">Change password</Link>
            </Button>
          </div>
        </div>
      )}

      {!emp && (
        <Card className="border-border shadow-sm">
          <CardContent className="text-muted-foreground py-6 text-sm leading-relaxed">
            <p className="mb-3">
              To see employment details, branch, and self-service contact edits, your account needs
              an employee profile. Ask HR or an administrator if this should be linked.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
