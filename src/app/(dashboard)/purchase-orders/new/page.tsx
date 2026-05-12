import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PurchaseOrderForm } from "@/components/purchase-orders/purchase-order-form";

export const metadata: Metadata = { title: "New Purchase Order" };

export default async function NewPurchaseOrderPage() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const [suppliers, locations, productsRaw] = await Promise.all([
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
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unitPrice: true },
    }),
  ]);

  const products = productsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unitPrice: Number(p.unitPrice),
  }));

  if (suppliers.length === 0 || locations.length === 0 || products.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="New Purchase Order"
          description="You need at least one supplier, location, and product before creating a PO."
        />
        <Button asChild variant="outline">
          <Link href="/purchase-orders">Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Purchase Order"
        description="Raise an order to restock a branch or van."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/purchase-orders">Cancel</Link>
          </Button>
        }
      />
      <PurchaseOrderForm suppliers={suppliers} locations={locations} products={products} />
    </div>
  );
}
