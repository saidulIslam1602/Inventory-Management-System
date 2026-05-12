import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ReceiveGoodsForm } from "@/components/inventory/receive-goods-form";

export const metadata: Metadata = { title: "Receive goods" };

export default async function ReceiveGoodsPage() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER", "STAFF"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receive goods"
        description="Scan a barcode (USB scanner) or type a SKU, set quantity and cost, then save. Creates an IN movement and increases on-hand stock."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory">Back to inventory</Link>
          </Button>
        }
      />
      <ReceiveGoodsForm locations={locations} />
    </div>
  );
}
