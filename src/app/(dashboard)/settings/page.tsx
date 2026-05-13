/**
 * Settings — org reference data; exception thresholds editable by Admin only.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Tag, Ruler, Users, Bell } from "lucide-react";
import { getAppSettings } from "@/lib/app-settings";
import { ExceptionThresholdsForm } from "@/components/settings/exception-thresholds-form";
import { canAccessSettingsPage } from "@/lib/rbac";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user || !canAccessSettingsPage(session.user.role)) {
    redirect("/dashboard");
  }

  const isAdmin = session.user.role === "ADMIN";

  const [locations, categories, units, users, departments, appSettings] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    getAppSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={
          isAdmin
            ? "Manage system configuration and exception thresholds"
            : "Org reference — locations, accounts, and catalog metadata. Threshold edits require an admin."
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isAdmin ? (
          <ExceptionThresholdsForm
            exceptionStaleSubmitDays={appSettings.exceptionStaleSubmitDays}
            exceptionOverdueReceiveDays={appSettings.exceptionOverdueReceiveDays}
            exceptionMinLowStockBranches={appSettings.exceptionMinLowStockBranches}
          />
        ) : (
          <Card className="border-border border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Exception thresholds</CardTitle>
              <CardDescription>
                Stale approval, overdue receive, and multi-branch low-stock rules (used on the
                manager hub). Only administrators can change these values.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-1 text-sm">
              <p>
                <span className="text-foreground font-medium">Stale submit</span> —{" "}
                {appSettings.exceptionStaleSubmitDays} day(s)
              </p>
              <p>
                <span className="text-foreground font-medium">Overdue receive</span> —{" "}
                {appSettings.exceptionOverdueReceiveDays} day(s)
              </p>
              <p>
                <span className="text-foreground font-medium">Min branches (low stock)</span> —{" "}
                {appSettings.exceptionMinLowStockBranches}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Locations ── */}
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <MapPin className="text-primary h-4 w-4" />
              Locations ({locations.length})
            </CardTitle>
            <CardDescription>Aqila&apos;s branches and service vehicles</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-border divide-y">
              {locations.map((loc) => (
                <div key={loc.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div>
                    <div className="text-foreground text-sm font-medium">{loc.name}</div>
                    <div className="text-muted-foreground text-xs">{loc.address ?? loc.type}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {loc.type}
                    </Badge>
                    {!loc.isActive && (
                      <Badge variant="destructive" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Users ── */}
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="text-primary h-4 w-4" />
              Users ({users.length})
            </CardTitle>
            <CardDescription>System accounts and role assignments</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-border max-h-64 divide-y overflow-y-auto">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div>
                    <div className="text-foreground text-sm font-medium">{user.name ?? "—"}</div>
                    <div className="text-muted-foreground text-xs">{user.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {user.role.toLowerCase()}
                    </Badge>
                    {!user.isActive && (
                      <Badge variant="destructive" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Categories ── */}
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Tag className="text-primary h-4 w-4" />
              Product Categories ({categories.length})
            </CardTitle>
            <CardDescription>Product taxonomy for inventory organisation</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-border divide-y">
              {categories.map((cat) => (
                <div key={cat.id} className="px-6 py-3">
                  <div className="text-foreground text-sm font-medium">{cat.name}</div>
                  {cat.description && (
                    <div className="text-muted-foreground text-xs">{cat.description}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Units + Departments ── */}
        <div className="space-y-6">
          <Card className="border-border border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Ruler className="text-primary h-4 w-4" />
                Units of Measure ({units.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {units.map((unit) => (
                  <Badge key={unit.id} variant="secondary" className="font-mono">
                    {unit.symbol} — {unit.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Bell className="text-primary h-4 w-4" />
                Departments ({departments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <Badge key={dept.id} variant="outline" className="text-xs">
                    {dept.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
