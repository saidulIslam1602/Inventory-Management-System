import { MovementType } from "@prisma/client";
import { movementQuantityDisplayPrefix } from "@/lib/stock-movement-display";

describe("movementQuantityDisplayPrefix", () => {
  test.each([
    [MovementType.OUT, "-"],
    [MovementType.RESERVED, "-"],
    [MovementType.IN, "+"],
    [MovementType.TRANSFER, "+"],
    [MovementType.ADJUSTMENT, "+"],
    [MovementType.RELEASED, "+"],
  ] as const)("type %s → %s", (type, expected) => {
    expect(movementQuantityDisplayPrefix(type)).toBe(expected);
  });
});
