/**
 * Customer profile — contact info and linked projects.
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await prisma.customer.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: c?.name ?? "Customer" };
}

export default async function CustomerDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: { select: { projects: true } },
      projects: {
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: {
          id: true,
          name: true,
          projectCode: true,
          status: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={
          customer.isActive ? (
            <span>
              {customer._count.projects} linked project
              {customer._count.projects === 1 ? "" : "s"}.
            </span>
          ) : (
            <span className="text-warning-foreground font-medium">This customer is inactive.</span>
          )
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/customers">All customers</Link>
            </Button>
            {session.user.role === "ADMIN" || session.user.role === "MANAGER" ? (
              <Button asChild size="sm">
                <Link href={`/customers/${customer.id}/edit`}>Edit</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">Projects</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {customer.email ? (
              <p>
                <span className="text-muted-foreground">Email · </span>
                <a className="text-primary hover:underline" href={`mailto:${customer.email}`}>
                  {customer.email}
                </a>
              </p>
            ) : null}
            {customer.phone ? (
              <p>
                <span className="text-muted-foreground">Phone · </span>
                <a className="text-primary hover:underline" href={`tel:${customer.phone}`}>
                  {customer.phone}
                </a>
              </p>
            ) : null}
            {customer.address ? (
              <p className="text-muted-foreground whitespace-pre-line">{customer.address}</p>
            ) : null}
            {customer.notes ? (
              <p className="border-border/60 text-muted-foreground whitespace-pre-wrap border-t pt-2">
                {customer.notes}
              </p>
            ) : null}
            {!customer.email && !customer.phone && !customer.address && !customer.notes ? (
              <p className="text-muted-foreground">No extra contact details on file.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Projects</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {customer.projects.length === 0 ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                No projects linked yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b text-left text-xs uppercase tracking-wide">
                      <th className="px-4 py-2.5">Code</th>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {customer.projects.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/15">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/projects/${p.id}`}
                            className="text-primary font-mono font-medium hover:underline"
                          >
                            {p.projectCode}
                          </Link>
                        </td>
                        <td className="max-w-[12rem] truncate px-4 py-2.5">{p.name}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5">
                          {format(p.updatedAt, "d. MMM yyyy", { locale: nb })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
