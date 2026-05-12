/**
 * CSV export for filtered stock movements (authenticated).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchParamFirst } from "@/lib/search-params";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";
import { rowsToCsv, withUtf8Bom } from "@/lib/csv";
import { buildStockMovementWhere, stockMovementListInclude } from "@/lib/queries/stock-movements";
import { stockMovementsExportQuerySchema } from "@/lib/validations/export-queries";
import { UserMessage } from "@/lib/user-messages";
import { canExportFinancialCsv } from "@/lib/rbac";

const EXPORT_CAP = 50_000;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: UserMessage.api.unauthorized }, { status: 401 });
  }
  if (!canExportFinancialCsv(session.user.role)) {
    return NextResponse.json({ error: UserMessage.api.forbidden }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const pick = (k: string) => {
    const v = searchParams.get(k);
    return searchParamFirst(v ?? undefined);
  };

  const filters = stockMovementsExportQuerySchema.safeParse({
    type: pick("type"),
    location: pick("location"),
    product: pick("product"),
    q: pick("q"),
    from: pick("from"),
    to: pick("to"),
  });
  if (!filters.success) {
    return NextResponse.json(
      {
        error: filters.error.issues[0]?.message ?? UserMessage.api.invalidExportFilters,
      },
      { status: 400 }
    );
  }

  const { type, location, product, q, from, to } = filters.data;

  const where = buildStockMovementWhere({
    type,
    locationId: location,
    productId: product,
    q,
    dateFrom: from,
    dateTo: to,
  });

  const rows = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: EXPORT_CAP,
    include: stockMovementListInclude,
  });

  const headers = [
    "Date (Oslo)",
    "Product",
    "SKU",
    "Location",
    "Type",
    "Qty",
    "Unit",
    "Unit cost (NOK)",
    "Line value (NOK)",
    "From loc.",
    "To loc.",
    "Note",
    "By",
  ];
  const data = rows.map((m) => {
    const uc = m.unitCost != null ? Number(m.unitCost) : null;
    const lineVal = m.type === "IN" && uc != null ? Number(m.quantity) * uc : "";
    return [
      m.createdAt.toLocaleString("sv-SE", { timeZone: BUSINESS_TIME_ZONE }),
      m.stock.product.name,
      m.stock.product.sku,
      m.stock.location.name,
      m.type,
      Number(m.quantity),
      m.stock.product.unit.symbol,
      uc != null ? uc : "",
      lineVal !== "" ? lineVal : "",
      m.fromLocation?.name ?? "",
      m.toLocation?.name ?? "",
      m.note ?? "",
      m.user?.name ?? "System",
    ];
  });

  const csv = withUtf8Bom(rowsToCsv(headers, data));
  const truncated = rows.length >= EXPORT_CAP;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-movements-${new Date().toISOString().slice(0, 10)}.csv"`,
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
}
