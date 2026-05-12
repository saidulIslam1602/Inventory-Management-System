/**
 * Inventory page — product catalog with stock levels per location.
 * Shows current quantities, reorder alerts, and movement history.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { StockLocationSummary } from "@/components/inventory/stock-location-summary";

export const metadata: Metadata = { title: "Inventory" };

async function getInventoryData() {
  const [products, locations, stockSummary] = await Promise.all([
    // All products with their stock across all locations
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        unit: true,
        supplier: { select: { name: true } },
        stock: {
          include: { location: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),

    // All active locations for the filter tabs
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),

    // Per-location stock counts for the summary cards
    prisma.location.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { stock: true } },
        stock: {
          select: { quantity: true, reorderPoint: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Count low-stock per location
  const locationStats = stockSummary.map((loc) => ({
    id: loc.id,
    name: loc.name,
    totalItems: loc._count.stock,
    lowStockCount: loc.stock.filter((s) => Number(s.quantity) <= Number(s.reorderPoint)).length,
  }));

  return { products, locations, locationStats };
}

export default async function InventoryPage() {
  const session = await auth();
  const { products, locations, locationStats } = await getInventoryData();

  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const lowStockTotal = locationStats.reduce((sum, loc) => sum + loc.lowStockCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`${products.length} products across ${locations.length} locations`}
        actions={
          canEdit && (
            <Button asChild size="sm">
              <Link href="/inventory/new">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Product
              </Link>
            </Button>
          )
        }
      />

      {/* ── Location Stock Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {locationStats.map((loc) => (
          <StockLocationSummary key={loc.id} {...loc} />
        ))}
      </div>

      {/* ── Low stock alert banner ── */}
      {lowStockTotal > 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          <Package className="h-4 w-4 shrink-0 text-yellow-600" />
          <span>
            <strong>{lowStockTotal} items</strong> are at or below their reorder point. Consider
            raising a purchase order.
          </span>
          <Button variant="outline" size="sm" className="ml-auto border-yellow-300 text-yellow-800 hover:bg-yellow-100" asChild>
            <Link href="/purchase-orders/new">Create PO</Link>
          </Button>
        </div>
      )}

      {/* ── Product Table ── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Products
            {lowStockTotal > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px]">
                {lowStockTotal} low
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          <InventoryTable products={products} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
