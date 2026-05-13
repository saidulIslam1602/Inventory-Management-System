import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole, type POStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReceiveOfflineQueueBanner } from "@/components/inventory/receive-offline-queue-banner";
import { ReceiveGoodsForm } from "@/components/inventory/receive-goods-form";
import {
  ReceivePurchaseOrderWizard,
  type ReceiveWizardCandidate,
  type ReceiveWizardPoDetail,
} from "@/components/inventory/receive-purchase-order-wizard";
import { searchParamFirst } from "@/lib/search-params";

export const metadata: Metadata = { title: "Receive goods" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReceiveGoodsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER", "STAFF"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const poRequested = searchParamFirst(sp.po);

  const staffLocationId =
    session.user.role === UserRole.STAFF
      ? ((
          await prisma.employee.findUnique({
            where: { userId: session.user.id },
            select: { locationId: true },
          })
        )?.locationId ?? null)
      : null;

  const staffNeedsProfile = session.user.role === UserRole.STAFF && !staffLocationId;

  const openForReceipt: POStatus[] = ["ORDERED", "PARTIALLY_RECEIVED"];

  const branchScope =
    session.user.role === UserRole.STAFF && staffLocationId ? { locationId: staffLocationId } : {};

  const wizardCandidatesRaw = staffNeedsProfile
    ? []
    : await prisma.purchaseOrder.findMany({
        where: { status: { in: openForReceipt }, ...branchScope },
        orderBy: { createdAt: "desc" },
        take: 80,
        select: {
          id: true,
          poNumber: true,
          status: true,
          supplier: { select: { name: true } },
          location: { select: { name: true } },
        },
      });

  const wizardCandidates: ReceiveWizardCandidate[] = wizardCandidatesRaw.map((r) => ({
    id: r.id,
    poNumber: r.poNumber,
    status: r.status,
    supplierName: r.supplier.name,
    locationName: r.location.name,
  }));

  let wizardDetail: ReceiveWizardPoDetail | null = null;
  let wizardErrorMessage: string | null = null;

  if (!staffNeedsProfile && poRequested) {
    const row = await prisma.purchaseOrder.findFirst({
      where: {
        id: poRequested,
        status: { in: openForReceipt },
        ...branchScope,
      },
      include: {
        supplier: { select: { name: true } },
        location: { select: { name: true } },
        items: {
          orderBy: { id: "asc" },
          include: { product: { include: { unit: true } } },
        },
      },
    });
    if (!row) {
      wizardErrorMessage =
        "That purchase order isn’t open for receiving from here — it may not exist, is already fulfilled, or is for another branch.";
    } else {
      wizardDetail = {
        purchaseOrderId: row.id,
        poNumber: row.poNumber,
        supplierName: row.supplier.name,
        locationName: row.location.name,
        lines: row.items.map((it) => ({
          id: it.id,
          orderedQuantity: Number(it.orderedQuantity),
          receivedQuantity: Number(it.receivedQuantity),
          unitPrice: Number(it.unitPrice),
          product: {
            name: it.product.name,
            sku: it.product.sku,
            unit: { symbol: it.product.unit.symbol },
          },
        })),
      };
    }
  }

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Receive goods"
        description="Quick SKU scan receives stock without a PO, or step through PO receiving with a dock-friendly wizard — both create audited IN movements."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory">Back to inventory</Link>
          </Button>
        }
      />

      <ReceiveOfflineQueueBanner userId={session.user.id} />

      <Card id="receive-po-wizard" className="border-primary/15 scroll-mt-24 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Guided PO receive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {staffNeedsProfile ? (
            <Alert>
              <AlertDescription>
                Your account needs a linked employee profile with a home branch to list purchase
                orders for receiving. Managers can assign this in Employees, or continue with{" "}
                <span className="font-medium">Quick receive</span> below where policy allows.
              </AlertDescription>
            </Alert>
          ) : null}
          <ReceivePurchaseOrderWizard
            candidates={wizardCandidates}
            detail={wizardDetail}
            wizardErrorMessage={wizardErrorMessage}
            offlineQueueUserId={session.user.id}
          />
        </CardContent>
      </Card>

      <div id="quick-receive" className="scroll-mt-24 space-y-3">
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Quick receive (no PO)</h2>
          <p className="text-muted-foreground text-sm">
            Scan or type SKU — useful for ad hoc adjustments when you are not posting against an
            open purchase order.
          </p>
        </div>
        <ReceiveGoodsForm locations={locations} offlineQueueUserId={session.user.id} />
      </div>
    </div>
  );
}
