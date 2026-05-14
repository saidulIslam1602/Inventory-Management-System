/**
 * Projects page — filters, pagination, CSV export, saved views.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SavedViewsBar } from "@/components/shared/saved-views-bar";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  searchParamFirst,
  searchParamPage,
  searchParamPageSize,
  toQueryString,
} from "@/lib/search-params";
import { PROJECT_STATUSES, buildProjectWhere } from "@/lib/queries/projects-list";
import { parseDashboardPins } from "@/lib/dashboard-pins";
import { format } from "date-fns";
import { DashboardPinToggle } from "@/components/dashboard/dashboard-pin-toggle";

export const metadata: Metadata = { title: "Projects" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await auth();
  const isViewer = session?.user?.role === "VIEWER";
  const viewerPinnedProjectIds =
    isViewer && session?.user?.id
      ? parseDashboardPins(
          (
            await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { dashboardPins: true },
            })
          )?.dashboardPins
        ).projectIds
      : [];

  const canManage = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const staffSelf =
    session?.user?.role === "STAFF"
      ? await prisma.employee.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })
      : null;

  const sp = await searchParams;
  const statusRaw = searchParamFirst(sp.status);
  const locationId = searchParamFirst(sp.location);
  const q = searchParamFirst(sp.q);
  const page = searchParamPage(sp.page);
  const pageSize = searchParamPageSize(sp.pageSize, 25, 10, 100);

  const status =
    statusRaw && (PROJECT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as ProjectStatus)
      : undefined;

  const where = buildProjectWhere({
    status,
    locationId,
    q,
    assignedToEmployeeId: staffSelf?.id,
  });

  const [total, projects, locations, statusGroups] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        location: { select: { name: true } },
        _count: { select: { employees: true, materials: true } },
        materials: {
          include: {
            product: { select: { unitPrice: true } },
          },
        },
      },
    }),
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
  ]);

  const projectsWithCost = projects.map((p) => ({
    ...p,
    materialCost: p.materials.reduce(
      (sum, m) => sum + Number(m.usedQuantity) * Number(m.unitCostAtTime),
      0
    ),
  }));

  const countByStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));

  const statusGroupsTiles = {
    active: countByStatus.IN_PROGRESS ?? 0,
    planning: countByStatus.PLANNING ?? 0,
    completed: countByStatus.COMPLETED ?? 0,
  };

  const hasFilters = Boolean(status || locationId || q);

  const baseParams: Record<string, string | undefined> = {
    status: statusRaw,
    location: locationId,
    q,
    pageSize: String(pageSize),
  };
  const exportQs = toQueryString({ status: statusRaw, location: locationId, q });
  const exportHref = exportQs ? `/api/export/projects?${exportQs}` : "/api/export/projects";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={
          staffSelf
            ? `${total.toLocaleString("nb-NO")} work orders assigned to you${hasFilters ? " (filtered)" : ""}`
            : `${total.toLocaleString("nb-NO")} work orders${hasFilters ? " match" : ""}`
        }
        actions={
          canManage && (
            <Button asChild size="sm">
              <Link href="/projects/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New Project
              </Link>
            </Button>
          )
        }
      />

      <Suspense fallback={null}>
        <SavedViewsBar storageId="projects" />
      </Suspense>

      <Card className="border-border border shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-wrap justify-end gap-2 px-4 pt-4">
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref}>Download CSV (filtered)</a>
            </Button>
          </div>
          <form
            method="get"
            action="/projects"
            className="border-border bg-muted/15 flex flex-col gap-3 border-b px-4 py-4"
          >
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Status</Label>
                <NativeSelect
                  name="status"
                  className="w-full max-w-none"
                  defaultValue={status ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All statuses</NativeSelectOption>
                  {PROJECT_STATUSES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Location</Label>
                <NativeSelect
                  name="location"
                  className="w-full max-w-none"
                  defaultValue={locationId ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All locations</NativeSelectOption>
                  {locations.map((l) => (
                    <NativeSelectOption key={l.id} value={l.id}>
                      {l.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-muted-foreground text-xs">Search code, name, client</Label>
                <Input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="PROJ-001, client, keywords…"
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Rows per page</Label>
                <NativeSelect
                  name="pageSize"
                  className="w-full max-w-none"
                  defaultValue={String(pageSize)}
                  size="sm"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <NativeSelectOption key={n} value={String(n)}>
                      {n}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm">
                  Apply
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/projects">Clear</Link>
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <div className="border-border bg-card min-w-24 rounded-lg border px-4 py-3 text-center">
          <div className="text-primary text-xl font-bold">{statusGroupsTiles.active}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">In progress</div>
        </div>
        <div className="border-border bg-card min-w-24 rounded-lg border px-4 py-3 text-center">
          <div className="text-foreground text-xl font-bold">{statusGroupsTiles.planning}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">Planning</div>
        </div>
        <div className="border-border bg-card min-w-24 rounded-lg border px-4 py-3 text-center">
          <div className="text-foreground text-xl font-bold">{statusGroupsTiles.completed}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">Completed</div>
        </div>
      </div>

      <Card className="border-border border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">All projects</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/30 border-b">
                  {[
                    "Code",
                    "Project",
                    "Location",
                    "Status",
                    "Client",
                    "Team",
                    "Materials",
                    "Cost",
                    "Start",
                    ...(isViewer ? [""] : []),
                    "",
                  ].map((h, i) => (
                    <th
                      key={`ph-${i}`}
                      className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {projectsWithCost.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isViewer ? 11 : 10}
                      className="text-muted-foreground px-4 py-12 text-center text-sm"
                    >
                      No projects match your filters.
                    </td>
                  </tr>
                ) : (
                  projectsWithCost.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground font-mono text-xs">
                          {p.projectCode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground font-medium">{p.name}</div>
                        {p.description && (
                          <div className="text-muted-foreground max-w-xs truncate text-xs">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">{p.location.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="text-muted-foreground px-4 py-3">{p.clientName ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{p._count.employees}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{p._count.materials}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-medium">
                        kr {p.materialCost.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-3 text-xs">
                        {p.startDate ? format(p.startDate, "d MMM yyyy") : "—"}
                      </td>
                      {isViewer ? (
                        <td className="px-4 py-3">
                          <DashboardPinToggle
                            kind="project"
                            entityId={p.id}
                            initialPinned={viewerPinnedProjectIds.includes(p.id)}
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/projects/${p.id}`}>View</Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ListPagination page={page} pageSize={pageSize} total={total} baseParams={baseParams} />
        </CardContent>
      </Card>
    </div>
  );
}
