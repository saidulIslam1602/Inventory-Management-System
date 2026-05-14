import { MovementType } from "@prisma/client";
import { buildStockMovementWhere } from "@/lib/queries/stock-movements";

describe("buildStockMovementWhere", () => {
  test("empty params → {}", () => {
    expect(buildStockMovementWhere({})).toEqual({});
  });

  test("type only", () => {
    expect(buildStockMovementWhere({ type: MovementType.IN })).toEqual({
      type: MovementType.IN,
    });
  });

  test("locationId + productId nest under stock", () => {
    expect(
      buildStockMovementWhere({
        locationId: "loc_1",
        productId: "prod_1",
      })
    ).toEqual({
      stock: { locationId: "loc_1", productId: "prod_1" },
    });
  });

  test("search q adds product OR filter", () => {
    const where = buildStockMovementWhere({ q: "cable" });
    expect(where.stock).toEqual({
      product: {
        OR: [
          { name: { contains: "cable", mode: "insensitive" } },
          { sku: { contains: "cable", mode: "insensitive" } },
          { barcode: { contains: "cable", mode: "insensitive" } },
        ],
      },
    });
  });

  test("valid date range adds createdAt bounds", () => {
    const where = buildStockMovementWhere({
      dateFrom: "2024-06-01",
      dateTo: "2024-06-02",
    });
    expect(where.createdAt).toBeDefined();
    const ca = where.createdAt as { gte?: Date; lte?: Date };
    expect(ca.gte).toBeInstanceOf(Date);
    expect(ca.lte).toBeInstanceOf(Date);
  });

  test("invalid date strings ignored", () => {
    expect(
      buildStockMovementWhere({
        dateFrom: "06-01-2024",
        dateTo: "not-a-date",
      })
    ).toEqual({});
  });
});
