/**
 * Authenticated quick search across products, POs, suppliers, projects (incl. client fields), customers, employees.
 * STAFF does not get employee directory hits (privacy / least surface).
 */

import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getResolvedFeatureFlags } from "@/lib/feature-flags-server";
import { globalSearchQuerySchema } from "@/lib/validations/common";
import { UserMessage } from "@/lib/user-messages";
import { checkApiRateLimit } from "@/lib/api-rate-limit";

function productPrimaryHref(
  p: { id: string; sku: string; barcode: string | null },
  qTrim: string,
  role: UserRole
): string {
  const ql = qTrim.toLowerCase();
  const exact =
    p.id === qTrim ||
    p.sku.toLowerCase() === ql ||
    (p.barcode != null && p.barcode.toLowerCase() === ql);
  const movements = `/inventory/movements?product=${p.id}`;
  if (role === UserRole.VIEWER) {
    return movements;
  }
  if (role === UserRole.STAFF) {
    return exact ? movements : `/inventory/${p.id}`;
  }
  return exact ? movements : `/inventory/${p.id}/edit`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: UserMessage.api.unauthorized }, { status: 401 });
  }

  const limited = await checkApiRateLimit(req, {
    store: "api:search",
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const role = session.user.role as UserRole;

  const qParsed = globalSearchQuerySchema.safeParse({
    q: new URL(req.url).searchParams.get("q") ?? "",
  });
  if (!qParsed.success) {
    return NextResponse.json(
      { error: qParsed.error.issues[0]?.message ?? UserMessage.api.invalidSearch },
      { status: 400 }
    );
  }
  const q = qParsed.data.q;
  if (q.length < 2) {
    return NextResponse.json({
      products: [],
      purchaseOrders: [],
      projects: [],
      employees: [],
      suppliers: [],
      customers: [],
    });
  }

  const qTrim = q.trim();

  try {
    const flags = await getResolvedFeatureFlags();

    const [
      exactIdOrCode,
      containsProducts,
      purchaseOrders,
      projects,
      employees,
      suppliers,
      customers,
    ] = await Promise.all([
      qTrim.length >= 20
        ? prisma.product.findFirst({
            where: { id: qTrim, isActive: true },
            select: { id: true, name: true, sku: true, barcode: true },
          })
        : Promise.resolve(null),
      prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 10,
        orderBy: { sku: "asc" },
        select: { id: true, name: true, sku: true, barcode: true },
      }),
      flags.purchaseOrders
        ? prisma.purchaseOrder.findMany({
            where: { poNumber: { contains: q, mode: "insensitive" } },
            take: 8,
            orderBy: { updatedAt: "desc" },
            select: { id: true, poNumber: true, status: true },
          })
        : Promise.resolve([]),
      flags.projects
        ? prisma.project.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { projectCode: { contains: q, mode: "insensitive" } },
                { clientName: { contains: q, mode: "insensitive" } },
                { clientPhone: { contains: q, mode: "insensitive" } },
              ],
            },
            take: 8,
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              name: true,
              projectCode: true,
              clientName: true,
              clientPhone: true,
            },
          })
        : Promise.resolve([]),
      role === UserRole.STAFF || !flags.employees
        ? Promise.resolve([])
        : prisma.employee.findMany({
            where: {
              isActive: true,
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { employeeCode: { contains: q, mode: "insensitive" } },
              ],
            },
            take: 8,
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            select: { id: true, firstName: true, lastName: true, employeeCode: true },
          }),
      prisma.supplier.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      flags.customers
        ? prisma.customer.findMany({
            where: {
              isActive: true,
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
              ],
            },
            take: 8,
            orderBy: { name: "asc" },
            select: { id: true, name: true, email: true, phone: true },
          })
        : Promise.resolve([]),
    ]);

    const exactSkuBarcode =
      exactIdOrCode ??
      (await prisma.product.findFirst({
        where: {
          isActive: true,
          OR: [
            { sku: { equals: qTrim, mode: "insensitive" } },
            { barcode: { equals: qTrim, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, sku: true, barcode: true },
      }));

    const seen = new Set<string>();
    const merged: Array<{
      id: string;
      name: string;
      sku: string;
      barcode: string | null;
      href: string;
    }> = [];

    if (exactSkuBarcode) {
      seen.add(exactSkuBarcode.id);
      merged.push({
        ...exactSkuBarcode,
        href: productPrimaryHref(exactSkuBarcode, qTrim, role),
      });
    }

    for (const p of containsProducts) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push({
        ...p,
        href: productPrimaryHref(p, qTrim, role),
      });
      if (merged.length >= 8) break;
    }

    return NextResponse.json({
      products: merged,
      purchaseOrders,
      projects,
      employees,
      suppliers,
      customers,
    });
  } catch {
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}
