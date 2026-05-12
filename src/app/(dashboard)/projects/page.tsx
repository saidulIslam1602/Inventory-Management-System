/**
 * Projects page — work orders with material tracking and job cost summary.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const session = await auth();
  const canManage = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      location: { select: { name: true } },
      _count: { select: { employees: true, materials: true } },
      materials: {
        include: {
          product: { select: { unitPrice: true } },
        },
      },
    },
  });

  // Compute job material cost per project
  const projectsWithCost = projects.map((p) => ({
    ...p,
    materialCost: p.materials.reduce(
      (sum, m) => sum + Number(m.usedQuantity) * Number(m.unitCostAtTime),
      0
    ),
  }));

  const statusGroups = {
    active: projects.filter((p) => p.status === "IN_PROGRESS").length,
    planning: projects.filter((p) => p.status === "PLANNING").length,
    completed: projects.filter((p) => p.status === "COMPLETED").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`${projects.length} work orders`}
        actions={
          canManage && (
            <Button asChild size="sm">
              <Link href="/projects/new">
                <Plus className="h-4 w-4 mr-1.5" />
                New Project
              </Link>
            </Button>
          )
        }
      />

      {/* ── Status pills ── */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-center min-w-24">
          <div className="text-xl font-bold text-primary">{statusGroups.active}</div>
          <div className="text-xs text-muted-foreground mt-0.5">In Progress</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-center min-w-24">
          <div className="text-xl font-bold text-foreground">{statusGroups.planning}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Planning</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-center min-w-24">
          <div className="text-xl font-bold text-foreground">{statusGroups.completed}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Completed</div>
        </div>
      </div>

      {/* ── Projects table ── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">All Projects</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Code", "Project", "Location", "Status", "Client", "Team", "Materials", "Cost", "Start", ""].map(
                    (h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projectsWithCost.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No projects yet. Create the first work order.
                    </td>
                  </tr>
                ) : (
                  projectsWithCost.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">{p.projectCode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs">{p.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.location.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.clientName ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{p._count.employees}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{p._count.materials}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-sm">
                        kr {p.materialCost.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {p.startDate ? format(p.startDate, "d MMM yyyy") : "—"}
                      </td>
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
        </CardContent>
      </Card>
    </div>
  );
}
