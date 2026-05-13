import type { MovementType } from "@prisma/client";

/** Prefix for ledger quantity column — aligns OUT / RESERVED consumption with movements screens. */
export function movementQuantityDisplayPrefix(type: MovementType): "-" | "+" {
  return type === "OUT" || type === "RESERVED" ? "-" : "+";
}
