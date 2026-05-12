/**
 * Project detail — overview, team, materials, status (managers can update status).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProjectStatusForm } from "@/components/projects/project-status-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.project.findUnique({
    where: { id },
    select: { name: true, projectCode: true },
  });
  if (!p) return { title: "Project" };
  return { title: `${p.projectCode}` };
}

export default async function ProjectDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      location: { select: { name: true } },
      employees: {
        include: {
          employee: {
            select: { firstName: true, lastName: true, employeeCode: true },
          },
        },
      },
      materials: {
        include: {
          product: { select: { name: true, sku: true, unit: { select: { symbol: true } } } },
        },
      },
    },
  });

  if (!project) notFound();

  if (session.user.role === "STAFF") {
    const emp = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!emp) redirect("/projects");
    const assigned = await prisma.projectEmployee.findUnique({
      where: {
        projectId_employeeId: { projectId: id, employeeId: emp.id },
      },
    });
    if (!assigned) redirect("/projects");
  }

  const canManage = session.user.role === "ADMIN" || session.user.role === "MANAGER";

  const materialCost = project.materials.reduce(
    (sum, m) => sum + Number(m.usedQuantity) * Number(m.unitCostAtTime),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${project.projectCode} · ${project.location.name}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">Back to projects</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border border shadow-none lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={project.status} />
              {project.clientName && (
                <span className="text-muted-foreground">Client: {project.clientName}</span>
              )}
            </div>
            {project.description && (
              <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
            )}
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Start</dt>
                <dd className="font-medium">
                  {project.startDate
                    ? format(project.startDate, "d. MMM yyyy", { locale: nb })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">End</dt>
                <dd className="font-medium">
                  {project.endDate ? format(project.endDate, "d. MMM yyyy", { locale: nb }) : "—"}
                </dd>
              </div>
              {project.clientPhone && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Client phone</dt>
                  <dd className="font-medium">{project.clientPhone}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {canManage && (
          <Card className="border-border border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Update status</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectStatusForm
                key={project.status}
                projectId={project.id}
                currentStatus={project.status}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-border border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Team</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {project.employees.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">No team assigned.</p>
          ) : (
            <ul className="divide-border divide-y">
              {project.employees.map((pe) => (
                <li key={pe.employeeId} className="flex justify-between gap-4 px-6 py-2.5 text-sm">
                  <span>
                    {pe.employee.firstName} {pe.employee.lastName}
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      {pe.employee.employeeCode}
                    </span>
                  </span>
                  {pe.role && <span className="text-muted-foreground text-xs">{pe.role}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border border shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Materials</CardTitle>
          <span className="text-muted-foreground font-mono text-sm">
            Consumed cost: kr{" "}
            {materialCost.toLocaleString("nb-NO", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/30 border-b">
                  {["Product", "SKU", "Reserved", "Used", "Unit", "Snapshot NOK"].map((h) => (
                    <th
                      key={h}
                      className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {project.materials.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-muted-foreground px-4 py-10 text-center text-sm"
                    >
                      No materials on this project yet.
                    </td>
                  </tr>
                ) : (
                  project.materials.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5">{m.product.name}</td>
                      <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                        {m.product.sku}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {Number(m.reservedQuantity)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{Number(m.usedQuantity)}</td>
                      <td className="text-muted-foreground px-4 py-2.5 text-xs">
                        {m.product.unit.symbol}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {Number(m.unitCostAtTime).toLocaleString("nb-NO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
