/**
 * Client-side safeguards for dock receiving — confirmations before posting large quantities.
 * Server actions remain authoritative; these reduce fat-finger corrections.
 */

/** PO line qty at or above this (per line) opens a confirmation. */
export const PO_RECEIVE_CONFIRM_LINE_QTY_MIN = 500;

/** Quick (non–PO-linked) receipt qty at or above this opens a confirmation. */
export const QUICK_RECEIVE_CONFIRM_QTY_MIN = 500;

export type PoConfirmLineHit = {
  sku: string;
  productName: string;
  receivedQuantity: number;
  unitSymbol: string;
};

export function quickReceiveQuantityNeedsConfirm(qty: number): boolean {
  return Number.isFinite(qty) && qty >= QUICK_RECEIVE_CONFIRM_QTY_MIN;
}

export function findPoReceiveLinesNeedingConfirm<
  L extends {
    id: string;
    product: { name: string; sku: string; unit: { symbol: string } };
  },
>(
  draftItems: { itemId: string; receivedQuantity: number }[],
  lines: L[],
  threshold = PO_RECEIVE_CONFIRM_LINE_QTY_MIN
): PoConfirmLineHit[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const out: PoConfirmLineHit[] = [];
  for (const i of draftItems) {
    if (i.receivedQuantity <= 0 || i.receivedQuantity < threshold) continue;
    const l = byId.get(i.itemId);
    if (!l) continue;
    out.push({
      sku: l.product.sku,
      productName: l.product.name,
      receivedQuantity: i.receivedQuantity,
      unitSymbol: l.product.unit.symbol,
    });
  }
  return out;
}
