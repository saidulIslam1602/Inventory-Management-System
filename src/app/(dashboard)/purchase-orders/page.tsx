/**
 * Purchase Orders page — filters, pagination, CSV export, saved views.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { POStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SavedViewsBar } from "@/components/shared/saved-views-bar";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  searchParamFirst,
  searchParamPage,
  searchParamPageSize,
  toQueryString,
} from "@/lib/search-params";
import { PO_STATUSES, buildPurchaseOrderWhere } from "@/lib/queries/purchase-orders-list";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Purchase Orders" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
  const session = await auth();
  const canCreate = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const sp = await searchParams;
  const statusRaw = searchParamFirst(sp.status);
  const supplierId = searchParamFirst(sp.supplier);
  const locationId = searchParamFirst(sp.location);
  const q = searchParamFirst(sp.q);
  const page = searchParamPage(sp.page);
  const pageSize = searchParamPageSize(sp.pageSize, 25, 10, 100);

  const status =
    statusRaw && (PO_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as POStatus)
      : undefined;

  const where = buildPurchaseOrderWhere({ status, supplierId, locationId, q });

  const [total, pos, suppliers, locations, statusGroups] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        supplier: { select: { id: true, name: true } },
        location: { select: { name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
  ]);

  const statusCounts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));

  const hasFilters = Boolean(status || supplierId || locationId || q);

  const baseParams: Record<string, string | undefined> = {
    status: statusRaw,
    supplier: supplierId,
    location: locationId,
    q,
    pageSize: String(pageSize),
  };
  const exportQs = toQueryString({
    status: statusRaw,
    supplier: supplierId,
    location: locationId,
    q,
  });
  const exportHref = exportQs
    ? `/api/export/purchase-orders?${exportQs}`
    : "/api/export/purchase-orders";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description={`${total.toLocaleString("nb-NO")} orders${hasFilters ? " match filters" : " total"}`}
        actions={
          canCreate && (
            <Button asChild size="sm">
              <Link href="/purchase-orders/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New Order
              </Link>
            </Button>
          )
        }
      />

      <Suspense fallback={null}>
        <SavedViewsBar storageId="purchase-orders" />
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
            action="/purchase-orders"
            className="border-border bg-muted/15 flex flex-col gap-3 border-b px-4 py-4"
          >
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Status</Label>
                <NativeSelect
                  name="status"
                  className="w-full max-w-none"
                  defaultValue={status ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All statuses</NativeSelectOption>
                  {PO_STATUSES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Supplier</Label>
                <NativeSelect
                  name="supplier"
                  className="w-full max-w-none"
                  defaultValue={supplierId ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All suppliers</NativeSelectOption>
                  {suppliers.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Deliver to</Label>
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
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <Label className="text-muted-foreground text-xs">
                  Search PO #, supplier, notes
                </Label>
                <Input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="PO-2026-0001, vendor name…"
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
                  <Link href="/purchase-orders">Clear</Link>
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([st, count]) => (
          <div key={st} className="flex items-center gap-1.5">
            <StatusBadge status={st} />
            <span className="text-muted-foreground text-xs font-medium">{count}</span>
          </div>
        ))}
      </div>

      <Card className="border-border border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Purchase orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/30 border-b">
                  {[
                    "PO Number",
                    "Supplier",
                    "Location",
                    "Status",
                    "Items",
                    "Total",
                    "Expected",
                    "Created By",
                    "",
                  ].map((h) => (
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
                {pos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-muted-foreground px-4 py-12 text-center text-sm"
                    >
                      No purchase orders match your filters.
                    </td>
                  </tr>
                ) : (
                  pos.map((po) => (
                    <tr key={po.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="text-primary font-mono font-semibold hover:underline"
                        >
                          {po.poNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/suppliers/${po.supplier.id}`}
                          className="text-primary hover:underline"
                        >
                          {po.supplier.name}
                        </Link>
                      </td>
                      <td className="text-muted-foreground px-4 py-3">{po.location.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className="font-mono">
                          {po._count.items}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium">
                        kr{" "}
                        {Number(po.totalAmount).toLocaleString("nb-NO", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-3">
                        {po.expectedDate ? format(po.expectedDate, "d MMM yyyy") : "—"}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">{po.createdBy.name}</td>
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
          <ListPagination page={page} pageSize={pageSize} total={total} baseParams={baseParams} />
        </CardContent>
      </Card>
    </div>
  );
}
