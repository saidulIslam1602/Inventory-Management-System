/**
 * Stock Movements log — immutable audit trail with filters, pagination, export, saved views.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MovementType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SavedViewsBar } from "@/components/shared/saved-views-bar";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  searchParamFirst,
  searchParamPage,
  searchParamPageSize,
  toQueryString,
} from "@/lib/search-params";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";
import { formatQuantityNbNo } from "@/lib/utils";
import {
  MOVEMENT_TYPES,
  buildStockMovementWhere,
  stockMovementListInclude,
} from "@/lib/queries/stock-movements";

export const metadata: Metadata = { title: "Stock Movements" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MovementsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const typeRaw = searchParamFirst(sp.type);
  const locationId = searchParamFirst(sp.location);
  const q = searchParamFirst(sp.q);
  const dateFrom = searchParamFirst(sp.from);
  const dateTo = searchParamFirst(sp.to);
  const page = searchParamPage(sp.page);
  const pageSize = searchParamPageSize(sp.pageSize, 50, 10, 100);

  const type =
    typeRaw && (MOVEMENT_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as MovementType)
      : undefined;

  const where = buildStockMovementWhere({ type, locationId, q, dateFrom, dateTo });

  const [total, movements, locations] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: stockMovementListInclude,
    }),
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const baseParams: Record<string, string | undefined> = {
    type: typeRaw,
    location: locationId,
    q,
    from: dateFrom,
    to: dateTo,
    pageSize: String(pageSize),
  };
  const exportQs = toQueryString({
    type: typeRaw,
    location: locationId,
    q,
    from: dateFrom,
    to: dateTo,
  });
  const exportHref = exportQs
    ? `/api/export/stock-movements?${exportQs}`
    : "/api/export/stock-movements";

  const hasFilters = Boolean(type || locationId || q || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        description="Immutable audit log — filter, paginate, export CSV, or save views in this browser"
      />

      <Suspense fallback={null}>
        <SavedViewsBar storageId="stock-movements" />
      </Suspense>

      <Card className="border-border border shadow-none">
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">Movement history</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
            <p className="text-muted-foreground text-xs">
              {hasFilters ? "Filters narrow the list." : "Showing latest movements first."} Oslo
              timestamps in the table.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref}>Download CSV (filtered)</a>
            </Button>
          </div>

          <form
            method="get"
            className="border-border bg-muted/15 flex flex-col gap-4 border-b px-4 py-4"
            action="/inventory/movements"
          >
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Movement type</Label>
                <NativeSelect
                  name="type"
                  className="w-full max-w-none"
                  defaultValue={type ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All types</NativeSelectOption>
                  {MOVEMENT_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Location</Label>
                <NativeSelect
                  name="location"
                  className="w-full max-w-none"
                  defaultValue={locationId ?? ""}
                  size="sm"
                >
                  <NativeSelectOption value="">All locations</NativeSelectOption>
                  {locations.map((loc) => (
                    <NativeSelectOption key={loc.id} value={loc.id}>
                      {loc.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-muted-foreground text-xs">
                  Product (name / SKU contains)
                </Label>
                <Input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="e.g. cable, NO-4821…"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">From (Oslo date)</Label>
                <Input type="date" name="from" defaultValue={dateFrom ?? ""} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">To (Oslo date)</Label>
                <Input type="date" name="to" defaultValue={dateTo ?? ""} className="h-8" />
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
                  Apply filters
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/inventory/movements">Clear</Link>
                </Button>
              </div>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border bg-muted/30 border-b">
                  {[
                    "Date",
                    "Product",
                    "Location",
                    "Type",
                    "Qty",
                    "Unit cost",
                    "Line value",
                    "From → To",
                    "Note",
                    "By",
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
                {movements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-muted-foreground px-4 py-12 text-center text-sm"
                    >
                      No movements match your filters.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
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
                        <div className="text-foreground text-sm font-medium">
                          {m.stock.product.name}
                        </div>
                        <div className="text-muted-foreground text-xs">{m.stock.product.sku}</div>
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-sm">
                        {m.stock.location.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={m.type} />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm font-semibold">
                        {["OUT", "RESERVED"].includes(m.type) ? "-" : "+"}
                        {formatQuantityNbNo(Number(m.quantity), m.stock.product.unit.symbol)}{" "}
                        {m.stock.product.unit.symbol}
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                        {m.unitCost != null
                          ? `kr ${Number(m.unitCost).toLocaleString("nb-NO", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                        {m.type === "IN" && m.unitCost != null
                          ? `kr ${(Number(m.quantity) * Number(m.unitCost)).toLocaleString(
                              "nb-NO",
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`
                          : "—"}
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-2.5 text-xs">
                        {m.fromLocation && m.toLocation
                          ? `${m.fromLocation.name} → ${m.toLocation.name}`
                          : "—"}
                      </td>
                      <td className="text-muted-foreground max-w-48 truncate px-4 py-2.5 text-sm">
                        {m.note ?? "—"}
                      </td>
                      <td className="text-muted-foreground px-4 py-2.5 text-sm">
                        {m.user?.name ?? "System"}
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
