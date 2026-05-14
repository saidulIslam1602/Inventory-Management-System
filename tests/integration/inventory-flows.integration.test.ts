/**
 * DB integration smoke — PO receive → movement; project reserve → consume.
 * Uses transaction rollback so rows never persist (single-worker `--runInBand`).
 */

import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { pgPoolConfigFromEnv } from "@/lib/db-pool-config";

class TransactionRollback extends Error {}

const prisma = new PrismaClient({
  adapter: new PrismaPg(pgPoolConfigFromEnv(process.env.DATABASE_URL!)),
});

function suffix(): string {
  return randomBytes(8).toString("hex");
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("inventory flows (integration)", () => {
  it("receive PO creates IN movement and increments stock", async () => {
    const sfx = suffix();

    try {
      await prisma.$transaction(async (tx) => {
        const category = await tx.category.create({
          data: { name: `cat-${sfx}` },
        });
        const unit = await tx.unit.create({
          data: { name: `unit-${sfx}`, symbol: `u${sfx.slice(0, 6)}` },
        });
        const product = await tx.product.create({
          data: {
            sku: `sku-${sfx}`,
            name: "Integration product",
            categoryId: category.id,
            unitId: unit.id,
            unitPrice: 10,
          },
        });
        const supplier = await tx.supplier.create({
          data: { name: `sup-${sfx}` },
        });
        const location = await tx.location.create({
          data: { name: `loc-${sfx}`, type: "BRANCH" },
        });
        const user = await tx.user.create({
          data: {
            email: `user-${sfx}@test.local`,
            role: "ADMIN",
            passwordHash: "unused",
            isActive: true,
          },
        });

        const po = await tx.purchaseOrder.create({
          data: {
            poNumber: `po-${sfx}`,
            status: "ORDERED",
            supplierId: supplier.id,
            locationId: location.id,
            createdById: user.id,
            items: {
              create: [
                {
                  orderedQuantity: 5,
                  receivedQuantity: 0,
                  unitPrice: 10,
                  productId: product.id,
                },
              ],
            },
          },
          include: { items: true },
        });

        const poItem = po.items[0]!;
        let stockRow = await tx.stock.findFirst({
          where: { productId: product.id, locationId: location.id },
        });
        if (!stockRow) {
          stockRow = await tx.stock.create({
            data: {
              productId: product.id,
              locationId: location.id,
              quantity: 0,
              reorderPoint: 0,
            },
          });
        }

        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQuantity: { increment: 3 } },
        });

        await tx.stockMovement.create({
          data: {
            stockId: stockRow.id,
            type: "IN",
            quantity: 3,
            unitCost: 10,
            note: `Received from PO ${po.poNumber}`,
            toLocationId: location.id,
            userId: user.id,
            purchaseOrderId: po.id,
          },
        });

        await tx.stock.update({
          where: { id: stockRow.id },
          data: { quantity: { increment: 3 } },
        });

        const movements = await tx.stockMovement.findMany({
          where: { purchaseOrderId: po.id },
        });
        expect(movements).toHaveLength(1);
        expect(movements[0]!.type).toBe("IN");
        expect(Number(movements[0]!.quantity)).toBe(3);

        const qty = await tx.stock.findUnique({
          where: { id: stockRow.id },
          select: { quantity: true },
        });
        expect(Number(qty!.quantity)).toBe(3);

        throw new TransactionRollback();
      });
    } catch (e) {
      if (!(e instanceof TransactionRollback)) throw e;
    }
  });

  it("project reserve then consume updates stock and movements", async () => {
    const sfx = suffix();

    try {
      await prisma.$transaction(async (tx) => {
        const category = await tx.category.create({
          data: { name: `cat2-${sfx}` },
        });
        const unit = await tx.unit.create({
          data: { name: `unit2-${sfx}`, symbol: `v${sfx.slice(0, 6)}` },
        });
        const product = await tx.product.create({
          data: {
            sku: `sku2-${sfx}`,
            name: "Integration product 2",
            categoryId: category.id,
            unitId: unit.id,
            unitPrice: 12,
          },
        });
        const location = await tx.location.create({
          data: { name: `loc2-${sfx}`, type: "BRANCH" },
        });
        const user = await tx.user.create({
          data: {
            email: `user2-${sfx}@test.local`,
            role: "ADMIN",
            passwordHash: "unused",
            isActive: true,
          },
        });

        const stockRow = await tx.stock.create({
          data: {
            productId: product.id,
            locationId: location.id,
            quantity: 10,
            reserved: 0,
            reorderPoint: 0,
          },
        });

        const project = await tx.project.create({
          data: {
            projectCode: `prj-${sfx}`,
            name: "Integration project",
            locationId: location.id,
            status: "IN_PROGRESS",
          },
        });

        await tx.projectMaterial.upsert({
          where: { projectId_productId: { projectId: project.id, productId: product.id } },
          update: { reservedQuantity: { increment: 4 } },
          create: {
            projectId: project.id,
            productId: product.id,
            reservedQuantity: 4,
            unitCostAtTime: 12,
          },
        });

        await tx.stock.update({
          where: { id: stockRow.id },
          data: { reserved: { increment: 4 } },
        });

        await tx.stockMovement.create({
          data: {
            stockId: stockRow.id,
            type: "RESERVED",
            quantity: 4,
            note: `Reserved for project ${project.id}`,
            userId: user.id,
            projectId: project.id,
          },
        });

        const pm = await tx.projectMaterial.findUnique({
          where: { projectId_productId: { projectId: project.id, productId: product.id } },
        });
        expect(pm).not.toBeNull();

        await tx.projectMaterial.update({
          where: { id: pm!.id },
          data: { usedQuantity: { increment: 2 } },
        });

        await tx.stock.update({
          where: { id: stockRow.id },
          data: {
            quantity: { decrement: 2 },
            reserved: { decrement: 2 },
          },
        });

        await tx.stockMovement.create({
          data: {
            stockId: stockRow.id,
            type: "OUT",
            quantity: 2,
            note: `Consumed in project ${project.id}`,
            userId: user.id,
            projectId: project.id,
          },
        });

        const refreshed = await tx.stock.findUnique({
          where: { id: stockRow.id },
          select: { quantity: true, reserved: true },
        });
        expect(Number(refreshed!.quantity)).toBe(8);
        expect(Number(refreshed!.reserved)).toBe(2);

        const moves = await tx.stockMovement.findMany({
          where: { stockId: stockRow.id },
          orderBy: { createdAt: "asc" },
        });
        expect(moves.map((m) => m.type)).toEqual(["RESERVED", "OUT"]);

        throw new TransactionRollback();
      });
    } catch (e) {
      if (!(e instanceof TransactionRollback)) throw e;
    }
  });
});
