/**
 * Stock Movements log — complete, immutable audit trail of all stock changes.
 * Filters by type, location, and date range.
 */

import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Stock Movements" };

export default async function MovementsPage() {
  const movements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      stock: {
        include: {
          product: { select: { name: true, sku: true, unit: { select: { symbol: true } } } },
          location: { select: { name: true } },
        },
      },
      user: { select: { name: true } },
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        description="Immutable audit log of all inventory changes"
      />

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Movement History ({movements.length} records)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Date", "Product", "Location", "Type", "Qty", "From → To", "Note", "By"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No movements recorded yet
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground text-xs">
                        {format(m.createdAt, "d MMM yyyy HH:mm")}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground text-sm">
                          {m.stock.product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{m.stock.product.sku}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-sm">
                        {m.stock.location.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={m.type} />
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-sm">
                        {["OUT", "RESERVED"].includes(m.type) ? "-" : "+"}
                        {Number(m.quantity)} {m.stock.product.unit.symbol}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                        {m.fromLocation && m.toLocation
                          ? `${m.fromLocation.name} → ${m.toLocation.name}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-sm max-w-48 truncate">
                        {m.note ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-sm">
                        {m.user?.name ?? "System"}
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
