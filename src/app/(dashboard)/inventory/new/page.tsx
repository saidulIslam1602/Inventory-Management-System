import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/inventory/product-form";

export const metadata: Metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const [categories, units, suppliers] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.unit.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, symbol: true },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (categories.length === 0 || units.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Add Product"
          description="Add categories and units to the database before creating products."
        />
        <Button asChild variant="outline">
          <Link href="/inventory">Back to inventory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Product"
        description="Register a new stock item in the catalogue."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory">Cancel</Link>
          </Button>
        }
      />
      <ProductForm categories={categories} units={units} suppliers={suppliers} />
    </div>
  );
}
