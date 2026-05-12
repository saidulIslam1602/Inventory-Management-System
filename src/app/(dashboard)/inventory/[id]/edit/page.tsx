import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/inventory/product-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { name: true } });
  return { title: product ? `Edit · ${product.name}` : "Edit Product" };
}

export default async function EditProductPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      barcode: true,
      purchaseUnitCost: true,
      name: true,
      description: true,
      unitPrice: true,
      categoryId: true,
      unitId: true,
      supplierId: true,
      imageUrl: true,
    },
  });

  if (!product) notFound();

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit product"
        description={product.name}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory">Back</Link>
          </Button>
        }
      />
      <ProductForm categories={categories} units={units} suppliers={suppliers} product={product} />
    </div>
  );
}
