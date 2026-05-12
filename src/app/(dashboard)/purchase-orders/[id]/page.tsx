/**
 * Purchase order detail — workflow actions, line items, goods-in receiving.
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
import { PurchaseOrderWorkflowButtons } from "@/components/manager/purchase-order-workflow-buttons";
import { PurchaseOrderReceiveForm } from "@/components/manager/purchase-order-receive-form";
import { formatQuantityNbNo } from "@/lib/utils";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { poNumber: true },
  });
  return { title: po ? po.poNumber : "Purchase order" };
}

export default async function PurchaseOrderDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      location: true,
      createdBy: { select: { name: true, email: true } },
      items: {
        include: { product: { include: { unit: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!po) notFound();

  const auditRows = await prisma.purchaseOrderAuditLog.findMany({
    where: { purchaseOrderId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { name: true, email: true } } },
  });

  const canManage = session.user.role === "ADMIN" || session.user.role === "MANAGER";
  const canSubmit = ["ADMIN", "MANAGER", "STAFF"].includes(session.user.role);
  const canReceive = ["ADMIN", "MANAGER", "STAFF"].includes(session.user.role);

  const receiving = po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED" ? po.items : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={po.poNumber}
        description={
          <>
            <Link
              href={`/suppliers/${po.supplier.id}`}
              className="text-foreground font-medium underline-offset-2 hover:underline"
            >
              {po.supplier.name}
            </Link>
            <span> → {po.location.name}</span>
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/purchase-orders">All orders</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">Status & workflow</CardTitle>
              <StatusBadge status={po.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <PurchaseOrderWorkflowButtons
              poId={po.id}
              status={po.status}
              canManage={canManage}
              canSubmit={canSubmit}
            />
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Total</dt>
                <dd className="font-mono font-medium">
                  kr{" "}
                  {Number(po.totalAmount).toLocaleString("nb-NO", {
                    minimumFractionDigits: 2,
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Expected</dt>
                <dd>{po.expectedDate ? format(po.expectedDate, "d MMM yyyy") : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Created</dt>
                <dd>{format(po.createdAt, "d MMM yyyy HH:mm")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Created by</dt>
                <dd>{po.createdBy.name ?? po.createdBy.email}</dd>
              </div>
            </dl>
            {po.notes && (
              <p className="text-muted-foreground border-border/60 border-t pt-3 text-sm">
                {po.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Delivery</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{po.location.name}</p>
            {po.location.address && (
              <p className="text-muted-foreground mt-1">{po.location.address}</p>
            )}
            <p className="text-muted-foreground mt-3 text-xs">
              Use receiving below once the supplier has shipped — inventory updates and movements
              are logged automatically.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b text-left text-xs uppercase tracking-wide">
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5">Ordered</th>
                  <th className="px-4 py-2.5">Received</th>
                  <th className="px-4 py-2.5">Unit price</th>
                  <th className="px-4 py-2.5">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {po.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{it.product.name}</div>
                      <div className="text-muted-foreground font-mono text-xs">
                        {it.product.sku}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatQuantityNbNo(Number(it.orderedQuantity), it.product.unit.symbol)}{" "}
                      {it.product.unit.symbol}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatQuantityNbNo(Number(it.receivedQuantity), it.product.unit.symbol)}{" "}
                      {it.product.unit.symbol}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono">
                      kr {Number(it.unitPrice).toLocaleString("nb-NO")}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">
                      kr{" "}
                      {(Number(it.orderedQuantity) * Number(it.unitPrice)).toLocaleString("nb-NO", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Activity log</CardTitle>
          <p className="text-muted-foreground text-xs font-normal">
            Status changes and receiving events (used for daily digest summaries).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {auditRows.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              No recorded events yet — workflow moves after this release are logged here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b text-left text-xs uppercase tracking-wide">
                    <th className="px-4 py-2.5">When</th>
                    <th className="px-4 py-2.5">Kind</th>
                    <th className="px-4 py-2.5">Transition</th>
                    <th className="px-4 py-2.5">Details</th>
                    <th className="px-4 py-2.5">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-xs">
                        {row.createdAt.toLocaleString("nb-NO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: BUSINESS_TIME_ZONE,
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={row.kind} />
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                        {(row.fromStatus ?? "—") + " → " + (row.toStatus ?? "—")}
                      </td>
                      <td className="text-muted-foreground max-w-xs px-4 py-2.5 text-xs">
                        {row.details ?? "—"}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-xs">
                        {row.actor?.name ?? row.actor?.email ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {receiving && canReceive && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Goods in (from this PO)</CardTitle>
            <p className="text-muted-foreground text-xs font-normal">
              Enter quantities to receive now — creates stock IN movements at {po.location.name}.
            </p>
          </CardHeader>
          <CardContent>
            <PurchaseOrderReceiveForm
              purchaseOrderId={po.id}
              lines={receiving.map((l) => ({
                id: l.id,
                orderedQuantity: Number(l.orderedQuantity),
                receivedQuantity: Number(l.receivedQuantity),
                unitPrice: Number(l.unitPrice),
                product: {
                  name: l.product.name,
                  sku: l.product.sku,
                  unit: { symbol: l.product.unit.symbol },
                },
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
