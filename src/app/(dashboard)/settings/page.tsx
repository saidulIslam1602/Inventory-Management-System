/**
 * Settings page — manage locations, categories, units, users, and system config.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Tag, Ruler, Users, Bell } from "lucide-react";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();

  // Only ADMIN can access settings
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [locations, categories, units, users, departments] = await Promise.all([
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage system configuration — Admin access only"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Locations ── */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Locations ({locations.length})
            </CardTitle>
            <CardDescription>Aqila&apos;s branches and service vehicles</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {locations.map((loc) => (
                <div key={loc.id} className="px-6 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm text-foreground">{loc.name}</div>
                    <div className="text-xs text-muted-foreground">{loc.address ?? loc.type}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{loc.type}</Badge>
                    {!loc.isActive && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Users ── */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Users ({users.length})
            </CardTitle>
            <CardDescription>System accounts and role assignments</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {users.map((user) => (
                <div key={user.id} className="px-6 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm text-foreground">{user.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px] capitalize">{user.role.toLowerCase()}</Badge>
                    {!user.isActive && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Categories ── */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Product Categories ({categories.length})
            </CardTitle>
            <CardDescription>Product taxonomy for inventory organisation</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {categories.map((cat) => (
                <div key={cat.id} className="px-6 py-3">
                  <div className="font-medium text-sm text-foreground">{cat.name}</div>
                  {cat.description && (
                    <div className="text-xs text-muted-foreground">{cat.description}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Units + Departments ── */}
        <div className="space-y-6">
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary" />
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

          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
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
