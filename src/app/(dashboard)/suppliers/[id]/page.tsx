/**
 * Supplier profile — contact details, product / PO rollups, recent orders.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await prisma.supplier.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: s?.name ?? "Supplier" };
}

export default async function SupplierDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true, purchaseOrders: true } },
    },
  });
  if (!supplier) notFound();

  const recentPo = await prisma.purchaseOrder.findMany({
    where: { supplierId: id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      poNumber: true,
      status: true,
      updatedAt: true,
      totalAmount: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        description={
          supplier.isActive ? (
            <span>
              {supplier._count.products} product{supplier._count.products === 1 ? "" : "s"} with
              this supplier · {supplier._count.purchaseOrders} purchase order
              {supplier._count.purchaseOrders === 1 ? "" : "s"} total.
            </span>
          ) : (
            <span className="text-warning-foreground font-medium">This supplier is inactive.</span>
          )
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/purchase-orders">All purchase orders</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {supplier.contactName ? (
              <p>
                <span className="text-muted-foreground">Contact · </span>
                {supplier.contactName}
              </p>
            ) : null}
            {supplier.email ? (
              <p>
                <span className="text-muted-foreground">Email · </span>
                <a className="text-primary hover:underline" href={`mailto:${supplier.email}`}>
                  {supplier.email}
                </a>
              </p>
            ) : null}
            {supplier.phone ? (
              <p>
                <span className="text-muted-foreground">Phone · </span>
                <a className="text-primary hover:underline" href={`tel:${supplier.phone}`}>
                  {supplier.phone}
                </a>
              </p>
            ) : null}
            {supplier.address ? (
              <p className="text-muted-foreground whitespace-pre-line">{supplier.address}</p>
            ) : null}
            {!supplier.contactName && !supplier.email && !supplier.phone && !supplier.address ? (
              <p className="text-muted-foreground">No contact details on file.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent purchase orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentPo.length === 0 ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                No orders for this supplier yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b text-left text-xs uppercase tracking-wide">
                      <th className="px-4 py-2.5">PO</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Updated</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentPo.map((po) => (
                      <tr key={po.id} className="hover:bg-muted/15">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/purchase-orders/${po.id}`}
                            className="text-primary font-mono font-medium hover:underline"
                          >
                            {po.poNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={po.status} />
                        </td>
                        <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5">
                          {format(po.updatedAt, "d MMM yyyy")}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          kr{" "}
                          {Number(po.totalAmount).toLocaleString("nb-NO", {
                            minimumFractionDigits: 2,
                          })}
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
