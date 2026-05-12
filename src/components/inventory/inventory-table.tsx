"use client";

/**
 * InventoryTable — client component for browsing and searching products.
 * Shows stock level per location with color-coded low-stock indicators.
 */

import { useState } from "react";
import Link from "next/link";
import { Edit2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StockEntry {
  id: string;
  quantity: { toString: () => string } | number | string;
  reorderPoint: { toString: () => string } | number | string;
  location: { id: string; name: string };
}

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  unitPrice: { toString: () => string } | number | string;
  category: { name: string };
  unit: { symbol: string };
  supplier?: { name: string } | null;
  stock: StockEntry[];
}

interface InventoryTableProps {
  products: ProductRow[];
  canEdit: boolean;
}

export function InventoryTable({ products, canEdit }: InventoryTableProps) {
  const columns: Column<ProductRow>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (p) => (
        <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
      ),
    },
    {
      key: "name",
      header: "Product",
      render: (p) => (
        <div>
          <div className="font-medium text-foreground">{p.name}</div>
          <div className="text-xs text-muted-foreground">{p.category.name}</div>
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
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : "bg-primary/10 text-primary border border-primary/20"
                  )}
                >
                  {isLow ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  <span>{s.location.name}</span>
                  <span className="font-bold">{qty}</span>
                  <span className="text-[10px] opacity-70">{p.unit.symbol}</span>
                </div>
              );
            })
          )}
        </div>
      ),
    },
    {
      key: "unitPrice",
      header: "Unit Price",
      render: (p) => (
        <span className="font-mono text-sm">
          kr {Number(p.unitPrice).toLocaleString("nb-NO", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (p) => (
        <span className="text-muted-foreground text-sm">{p.supplier?.name ?? "—"}</span>
      ),
    },
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

  return (
    <div className="px-1">
      <DataTable
        data={products}
        columns={columns}
        searchPlaceholder="Search products by name or SKU..."
        searchKeys={["name", "sku"]}
        pageSize={20}
      />
    </div>
  );
}
