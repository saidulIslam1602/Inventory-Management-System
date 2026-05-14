/**
 * CSV export for projects (authenticated).
 */

import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchParamFirst } from "@/lib/search-params";
import { rowsToCsv, withUtf8Bom } from "@/lib/csv";
import { buildProjectWhere } from "@/lib/queries/projects-list";
import { projectsExportQuerySchema } from "@/lib/validations/export-queries";
import { UserMessage } from "@/lib/user-messages";
import { canExportFinancialCsv } from "@/lib/rbac";
import { auditCsvExportDownload } from "@/lib/audit/record-event";

const EXPORT_CAP = 50_000;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: UserMessage.api.unauthorized }, { status: 401 });
  }
  if (!canExportFinancialCsv(session.user.role)) {
    return NextResponse.json({ error: UserMessage.api.forbidden }, { status: 403 });
  }

  const limited = await checkApiRateLimit(req, {
    store: "api:export:projects",
    limit: 10,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const staffSelf =
    session.user.role === "STAFF"
      ? await prisma.employee.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })
      : null;

  const { searchParams } = new URL(req.url);
  const pick = (k: string) => searchParamFirst(searchParams.get(k) ?? undefined);

  const filters = projectsExportQuerySchema.safeParse({
    status: pick("status"),
    location: pick("location"),
    q: pick("q"),
  });
  if (!filters.success) {
    return NextResponse.json(
      {
        error: filters.error.issues[0]?.message ?? UserMessage.api.invalidExportFilters,
      },
      { status: 400 }
    );
  }

  const { status, location, q } = filters.data;

  const where = buildProjectWhere({
    status,
    locationId: location,
    q,
    assignedToEmployeeId: staffSelf?.id,
  });

  try {
    const rows = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_CAP,
      include: {
        location: { select: { name: true } },
        _count: { select: { employees: true, materials: true } },
        materials: { include: { product: { select: { unitPrice: true } } } },
      },
    });

    const headers = [
      "Code",
      "Name",
      "Status",
      "Location",
      "Client",
      "Team",
      "Materials lines",
      "Material cost (kr)",
      "Start",
      "Created",
    ];
    const data = rows.map((p) => {
      const materialCost = p.materials.reduce(
        (sum, m) => sum + Number(m.usedQuantity) * Number(m.unitCostAtTime),
        0
      );
      return [
        p.projectCode,
        p.name,
        p.status,
        p.location.name,
        p.clientName ?? "",
        p._count.employees,
        p._count.materials,
        materialCost,
        p.startDate ? format(p.startDate, "yyyy-MM-dd") : "",
        format(p.createdAt, "yyyy-MM-dd HH:mm"),
      ];
    });

    const csv = withUtf8Bom(rowsToCsv(headers, data));
    const truncated = rows.length >= EXPORT_CAP;

    await auditCsvExportDownload({
      req,
      actor: { id: session.user.id, email: session.user.email },
      exportKind: "projects_csv",
      summary: `Exported projects CSV (${rows.length} rows${truncated ? ", truncated" : ""}).`,
      metadata: { filters: filters.data, rowCount: rows.length, truncated },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="projects-${new Date().toISOString().slice(0, 10)}.csv"`,
        ...(truncated ? { "X-Export-Truncated": "true" } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
