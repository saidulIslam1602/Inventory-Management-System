import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";
import { stockMovementListInclude } from "@/lib/queries/stock-movements";
import { canViewCatalogPricing } from "@/lib/rbac";
import { movementQuantityDisplayPrefix } from "@/lib/stock-movement-display";
import { cn, formatQuantityNbNo } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true, isActive: true },
  });
  if (!product?.isActive) return { title: "Product" };
  return { title: `${product.name} · Inventory` };
}

const RECENT_MOVEMENTS = 8;

export default async function ProductOverviewPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) notFound();

  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: {
      category: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true, symbol: true } },
      supplier: { select: { id: true, name: true } },
      stock: {
        include: { location: { select: { id: true, name: true } } },
        orderBy: { location: { name: "asc" } },
      },
    },
  });

  if (!product) notFound();

  const recentMovements = await prisma.stockMovement.findMany({
    where: { stock: { productId: id } },
    orderBy: { createdAt: "desc" },
    take: RECENT_MOVEMENTS,
    include: {
      ...stockMovementListInclude,
      purchaseOrder: { select: { id: true } },
      project: { select: { id: true, name: true } },
    },
  });

  const movementsFullLogHref = `/inventory/movements?product=${encodeURIComponent(product.id)}`;
  const canEdit = session.user.role === "ADMIN" || session.user.role === "MANAGER";
  const showPricing = canViewCatalogPricing(session.user.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={
          <span className="text-muted-foreground font-normal">
            <span className="font-mono text-xs">{product.sku}</span>
            {product.barcode?.trim() ? (
              <>
                {" · "}
                <span className="font-mono text-xs">{product.barcode.trim()}</span>
              </>
            ) : null}
            {" · "}
            {product.category.name}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/inventory">Back to inventory</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link href={movementsFullLogHref}>
                Full movement log
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
            {canEdit && (
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/inventory/${product.id}/edit`}>Edit product</Link>
              </Button>
            )}
          </div>
        }
      />

      <Card className="border-border border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            How this stock level is determined
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm leading-relaxed">
          <p>
            On-hand quantity for each location is the running balance from{" "}
            <strong className="text-foreground">recorded stock movements</strong> only — goods-in
            (including PO receipts), transfers between locations, adjustments, reservations, and
            project consumption. Nothing changes the ledger except those immutable movement rows.
          </p>
          <p>
            If a number looks unexpected, use{" "}
            <Link
              className="text-primary font-medium underline underline-offset-4"
              href={movementsFullLogHref}
            >
              the filtered movement log for this product
            </Link>{" "}
            to see every change in time order (Oslo timestamps).
          </p>
        </CardContent>
      </Card>

      <Card className="border-border border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Stock by location</CardTitle>
        </CardHeader>
        <CardContent>
          {product.stock.length === 0 ? (
            <p className="text-muted-foreground text-sm">No stock rows yet for this product.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {product.stock.map((s) => {
                const qty = Number(s.quantity);
                const reorder = Number(s.reorderPoint);
                const isLow = qty <= reorder;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm",
                      isLow
                        ? "border-destructive/25 bg-destructive/10 text-destructive"
                        : "border-primary/20 bg-primary/10 text-primary"
                    )}
                  >
                    {isLow ? (
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    )}
                    <span className="font-medium">{s.location.name}</span>
                    <span className="font-mono font-semibold">
                      {formatQuantityNbNo(qty, product.unit.symbol)} {product.unit.symbol}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      (reorder ≤ {formatQuantityNbNo(reorder, product.unit.symbol)})
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Catalog</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span>Unit</span>
              <span className="text-foreground font-medium">
                {product.unit.name} ({product.unit.symbol})
              </span>
            </div>
            {showPricing ? (
              <div className="flex justify-between gap-4">
                <span>List price</span>
                <span className="text-foreground font-mono font-medium">
                  kr{" "}
                  {Number(product.unitPrice).toLocaleString("nb-NO", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span>Supplier</span>
              <span className="text-foreground text-right font-medium">
                {product.supplier?.name ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border border shadow-none">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-semibold">Latest movements</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={movementsFullLogHref}>Open log</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            {recentMovements.length === 0 ? (
              <p className="text-muted-foreground px-6 pb-6 text-sm">
                No movements recorded yet for this product.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border bg-muted/30 border-b">
                      <th className="text-muted-foreground px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">
                        When (Oslo)
                      </th>
                      <th className="text-muted-foreground px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-muted-foreground px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="text-muted-foreground px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">
                        Location
                      </th>
                      <th className="text-muted-foreground px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">
                        Context
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {recentMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                        <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-xs">
                          {m.createdAt.toLocaleString("nb-NO", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: BUSINESS_TIME_ZONE,
                          })}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={m.type} className="normal-case" />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm font-semibold">
                          {movementQuantityDisplayPrefix(m.type)}
                          {formatQuantityNbNo(Number(m.quantity), m.stock.product.unit.symbol)}{" "}
                          {m.stock.product.unit.symbol}
                        </td>
                        <td className="text-muted-foreground px-4 py-2.5 text-xs">
                          {m.stock.location.name}
                        </td>
                        <td className="text-muted-foreground max-w-[14rem] px-4 py-2.5 text-xs">
                          <div className="flex flex-col gap-1">
                            {m.purchaseOrder ? (
                              <Link
                                className="text-primary font-medium underline underline-offset-2"
                                href={`/purchase-orders/${m.purchaseOrder.id}`}
                              >
                                Purchase order
                              </Link>
                            ) : null}
                            {m.project ? (
                              <Link
                                className="text-primary font-medium underline underline-offset-2"
                                href={`/projects/${m.project.id}`}
                              >
                                {m.project.name}
                              </Link>
                            ) : null}
                            {m.note ? (
                              <span className="line-clamp-2" title={m.note}>
                                {m.note}
                              </span>
                            ) : null}
                            {!m.purchaseOrder && !m.project && !m.note ? "—" : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {recentMovements.length >= RECENT_MOVEMENTS ? (
              <p className="text-muted-foreground border-border border-t px-4 py-3 text-xs">
                Showing the {RECENT_MOVEMENTS} most recent rows.{" "}
                <Link
                  className="text-primary font-medium underline underline-offset-4"
                  href={movementsFullLogHref}
                >
                  View all movements
                </Link>
                .
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
