"use client";

/**
 * InventoryTable — product catalog table with search and filters
 * (category, supplier, location, stock health) typical of IMS UIs.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Edit2, AlertTriangle, CheckCircle2, Filter } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { DashboardPinToggle } from "@/components/dashboard/dashboard-pin-toggle";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn, formatQuantityNbNo } from "@/lib/utils";
import { rowsToCsv, withUtf8Bom } from "@/lib/csv";

interface StockEntry {
  id: string;
  quantity: { toString: () => string } | number | string;
  reorderPoint: { toString: () => string } | number | string;
  location: { id: string; name: string };
}

interface ProductRow {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  unitPrice: { toString: () => string } | number | string;
  category: { id: string; name: string };
  supplier?: { id: string; name: string } | null;
  unit: { symbol: string };
  stock: StockEntry[];
}

export interface InventoryFilterOption {
  id: string;
  name: string;
}

interface InventoryTableProps {
  products: ProductRow[];
  canEdit: boolean;
  /** When false (VIEWER), hide unit price column and omit pricing from client CSV export. */
  showPricingColumns?: boolean;
  categories: InventoryFilterOption[];
  suppliers: InventoryFilterOption[];
  locations: InventoryFilterOption[];
  /** When set (typically for VIEWER), show a bookmark column to pin rows to the dashboard watchlist. */
  viewerPinnedProductIds?: string[];
}

type StockHealthFilter = "all" | "low" | "healthy";

const NO_SUPPLIER = "__none__";

export function InventoryTable({
  products,
  canEdit,
  showPricingColumns = true,
  categories,
  suppliers,
  locations,
  viewerPinnedProductIds,
}: InventoryTableProps) {
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [stockHealth, setStockHealth] = useState<StockHealthFilter>("all");

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryId && p.category.id !== categoryId) return false;

      if (supplierId) {
        if (supplierId === NO_SUPPLIER) {
          if (p.supplier != null) return false;
        } else if (p.supplier?.id !== supplierId) {
          return false;
        }
      }

      if (locationId) {
        const atLoc = p.stock.some((s) => s.location.id === locationId);
        if (!atLoc) return false;
      }

      if (stockHealth !== "all") {
        const hasLow = p.stock.some((s) => Number(s.quantity) <= Number(s.reorderPoint));
        if (stockHealth === "low" && !hasLow) return false;
        if (stockHealth === "healthy" && hasLow) return false;
      }

      return true;
    });
  }, [products, categoryId, supplierId, locationId, stockHealth]);

  const hasActiveFilters =
    categoryId !== "" || supplierId !== "" || locationId !== "" || stockHealth !== "all";

  function exportFilteredCsv() {
    const headers = [
      "SKU",
      "Barcode",
      "Name",
      "Category",
      "Supplier",
      ...(showPricingColumns ? ["Unit price (kr)"] : []),
      "Stock by location",
    ];
    const data = filteredProducts.map((p) => {
      const stockCell = p.stock
        .map(
          (s) =>
            `${s.location.name}: ${formatQuantityNbNo(Number(s.quantity), p.unit.symbol)} ${p.unit.symbol}${
              Number(s.quantity) <= Number(s.reorderPoint) ? " (low)" : ""
            }`
        )
        .join(" | ");
      const base = [p.sku, p.barcode ?? "", p.name, p.category.name, p.supplier?.name ?? ""];
      if (showPricingColumns) {
        base.push(Number(p.unitPrice).toLocaleString("nb-NO", { minimumFractionDigits: 2 }));
      }
      base.push(stockCell);
      return base;
    });
    const blob = new Blob([withUtf8Bom(rowsToCsv(headers, data))], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: Column<ProductRow>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (p) => <span className="text-muted-foreground font-mono text-xs">{p.sku}</span>,
    },
    {
      key: "barcode",
      header: "Barcode",
      render: (p) => (
        <span className="text-muted-foreground font-mono text-xs">{p.barcode?.trim() || "—"}</span>
      ),
    },
    {
      key: "name",
      header: "Product",
      render: (p) => (
        <div>
          <Link
            href={`/inventory/${p.id}`}
            className="text-foreground hover:text-primary font-medium underline-offset-4 hover:underline"
          >
            {p.name}
          </Link>
          <div className="text-muted-foreground text-xs">{p.category.name}</div>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock by Location",
      render: (p) => (
        <div className="flex flex-wrap gap-1.5">
          {p.stock.length === 0 ? (
            <span className="text-muted-foreground text-xs">No stock tracked</span>
          ) : (
            p.stock.map((s) => {
              const qty = Number(s.quantity);
              const reorder = Number(s.reorderPoint);
              const isLow = qty <= reorder;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
                    isLow
                      ? "bg-destructive/10 text-destructive border-destructive/20 border"
                      : "bg-primary/10 text-primary border-primary/20 border"
                  )}
                >
                  {isLow ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  <span>{s.location.name}</span>
                  <span className="font-bold">{formatQuantityNbNo(qty, p.unit.symbol)}</span>
                  <span className="text-[10px] opacity-70">{p.unit.symbol}</span>
                </div>
              );
            })
          )}
        </div>
      ),
    },
    ...(showPricingColumns
      ? [
          {
            key: "unitPrice",
            header: "Unit Price",
            render: (p: ProductRow) => (
              <span className="font-mono text-sm">
                kr {Number(p.unitPrice).toLocaleString("nb-NO", { minimumFractionDigits: 2 })}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "supplier",
      header: "Supplier",
      render: (p) => (
        <span className="text-muted-foreground text-sm">{p.supplier?.name ?? "—"}</span>
      ),
    },
    ...(viewerPinnedProductIds !== undefined
      ? [
          {
            key: "watchlist",
            header: "",
            render: (p: ProductRow) => (
              <DashboardPinToggle
                kind="product"
                entityId={p.id}
                initialPinned={viewerPinnedProductIds.includes(p.id)}
              />
            ),
            className: "w-11",
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            key: "actions",
            header: "",
            render: (p: ProductRow) => (
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href={`/inventory/${p.id}/edit`}>
                  <Edit2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit {p.name}</span>
                </Link>
              </Button>
            ),
            className: "w-12 text-right",
          },
        ]
      : []),
  ];

  const toolbar = (
    <div className="border-border bg-muted/15 space-y-3 rounded-lg border px-4 py-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs font-medium">
        <Filter className="h-3.5 w-3.5" />
        <span>Filter catalog</span>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setCategoryId("");
              setSupplierId("");
              setLocationId("");
              setStockHealth("all");
            }}
          >
            Clear all
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={exportFilteredCsv}
        >
          Export CSV (filtered)
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Category</Label>
          <NativeSelect
            size="sm"
            className="w-full max-w-none"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <NativeSelectOption value="">All categories</NativeSelectOption>
            {categories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Supplier</Label>
          <NativeSelect
            size="sm"
            className="w-full max-w-none"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <NativeSelectOption value="">All suppliers</NativeSelectOption>
            <NativeSelectOption value={NO_SUPPLIER}>No supplier</NativeSelectOption>
            {suppliers.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Stock at location</Label>
          <NativeSelect
            size="sm"
            className="w-full max-w-none"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <NativeSelectOption value="">Any location</NativeSelectOption>
            {locations.map((l) => (
              <NativeSelectOption key={l.id} value={l.id}>
                {l.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Stock health</Label>
          <NativeSelect
            size="sm"
            className="w-full max-w-none"
            value={stockHealth}
            onChange={(e) => setStockHealth(e.target.value as StockHealthFilter)}
          >
            <NativeSelectOption value="all">All</NativeSelectOption>
            <NativeSelectOption value="low">Low / reorder or below</NativeSelectOption>
            <NativeSelectOption value="healthy">Above reorder everywhere</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      {hasActiveFilters && (
        <p className="text-muted-foreground text-xs">
          Showing {filteredProducts.length} of {products.length} products
        </p>
      )}
    </div>
  );

  return (
    <div className="px-1">
      <DataTable
        data={filteredProducts}
        columns={columns}
        toolbar={toolbar}
        searchPlaceholder="Search products by name or SKU..."
        searchKeys={["name", "sku"]}
        pageSize={20}
        emptyState={
          <div className="text-muted-foreground text-sm">
            {hasActiveFilters
              ? "No products match the current filters. Try clearing or changing them."
              : "No data available."}
          </div>
        }
      />
    </div>
  );
}
