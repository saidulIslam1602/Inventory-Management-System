/**
 * CSV export for purchase orders (authenticated).
 */

import { NextResponse } from "next/server";
import { POStatus } from "@prisma/client";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchParamFirst } from "@/lib/search-params";
import { rowsToCsv, withUtf8Bom } from "@/lib/csv";
import { PO_STATUSES, buildPurchaseOrderWhere } from "@/lib/queries/purchase-orders-list";

const EXPORT_CAP = 50_000;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pick = (k: string) => searchParamFirst(searchParams.get(k) ?? undefined);

  const statusRaw = pick("status");
  const status =
    statusRaw && (PO_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as POStatus)
      : undefined;

  const where = buildPurchaseOrderWhere({
    status,
    supplierId: pick("supplier"),
    locationId: pick("location"),
    q: pick("q"),
  });

  const rows = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_CAP,
    include: {
      supplier: { select: { name: true } },
      location: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
  });

  const headers = [
    "PO number",
    "Status",
    "Supplier",
    "Deliver to",
    "Items",
    "Total (kr)",
    "Expected",
    "Created",
    "Created by",
  ];
  const data = rows.map((po) => [
    po.poNumber,
    po.status,
    po.supplier.name,
    po.location.name,
    po._count.items,
    Number(po.totalAmount),
    po.expectedDate ? format(po.expectedDate, "yyyy-MM-dd") : "",
    format(po.createdAt, "yyyy-MM-dd HH:mm"),
    po.createdBy.name ?? po.createdBy.email,
  ]);

  const csv = withUtf8Bom(rowsToCsv(headers, data));
  const truncated = rows.length >= EXPORT_CAP;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
}
