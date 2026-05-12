/**
 * Customer directory — master end-clients linked from projects.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersListPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canManage = session.user.role === "ADMIN" || session.user.role === "MANAGER";

  const rows = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      _count: { select: { projects: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Master client records. Projects can link here instead of ad-hoc name/phone only."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Button asChild size="sm">
                <Link href="/customers/new">New customer</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">Projects</Link>
            </Button>
          </div>
        }
      />

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">All customers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              No customers yet.
              {session.user.role === "ADMIN" || session.user.role === "MANAGER" ? (
                <>
                  {" "}
                  <Link href="/customers/new" className="text-primary font-medium hover:underline">
                    Create one
                  </Link>
                  , or seed demo data.
                </>
              ) : (
                " Ask an admin to add records or seed demo data."
              )}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b text-left text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Contact</th>
                    <th className="px-4 py-2.5 text-right">Projects</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/15">
                      <td className="px-4 py-2.5 font-medium">
                        <Link href={`/customers/${r.id}`} className="text-primary hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-xs">
                        {[r.email, r.phone].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {r._count.projects}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.isActive ? (
                          <span className="text-success-foreground text-xs font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/customers/${r.id}`}>View</Link>
                        </Button>
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
  );
}
