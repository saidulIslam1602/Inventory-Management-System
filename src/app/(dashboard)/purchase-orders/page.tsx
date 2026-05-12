/**
 * Purchase Orders page — list of all POs with status, supplier, and totals.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Purchase Orders" };

export default async function PurchaseOrdersPage() {
  const session = await auth();
  const canCreate = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const pos = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      location: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  const statusCounts = pos.reduce<Record<string, number>>((acc, po) => {
    acc[po.status] = (acc[po.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description={`${pos.length} orders total`}
        actions={
          canCreate && (
            <Button asChild size="sm">
              <Link href="/purchase-orders/new">
                <Plus className="h-4 w-4 mr-1.5" />
                New Order
              </Link>
            </Button>
          )
        }
      />

      {/* ── Status summary pills ── */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5">
            <StatusBadge status={status} />
            <span className="text-xs text-muted-foreground font-medium">{count}</span>
          </div>
        ))}
      </div>

      {/* ── PO table ── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">All Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["PO Number", "Supplier", "Location", "Status", "Items", "Total", "Expected", "Created By", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No purchase orders yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  pos.map((po) => (
                    <tr key={po.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/purchase-orders/${po.id}`} className="font-mono font-semibold text-primary hover:underline">
                          {po.poNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{po.supplier.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{po.location.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className="font-mono">{po._count.items}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium">
                        kr {Number(po.totalAmount).toLocaleString("nb-NO", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {po.expectedDate ? format(po.expectedDate, "d MMM yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{po.createdBy.name}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/purchase-orders/${po.id}`}>View</Link>
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
