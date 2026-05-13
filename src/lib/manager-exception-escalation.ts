import type { ExceptionItem } from "@/lib/queries/manager-overview";

/**
 * Manager hub exceptions that reference a PO can log an escalation on that order’s audit trail.
 */
export function purchaseOrderIdFromException(
  ex: Pick<ExceptionItem, "id" | "href">
): string | null {
  const stale = ex.id.match(/^po-stale-(.+)$/);
  if (stale?.[1]) return stale[1];
  const recv = ex.id.match(/^po-recv-(.+)$/);
  if (recv?.[1]) return recv[1];
  const hrefPo = ex.href.match(/^\/purchase-orders\/([^/?#]+)$/);
  return hrefPo?.[1] ?? null;
}

/** Short text of ordered − received per line (audit / supplier follow-up). */
export function formatPurchaseOrderLineGapSummary(
  items: ReadonlyArray<{
    orderedQuantity: unknown;
    receivedQuantity: unknown;
    product: { sku: string };
  }>
): string {
  const parts: string[] = [];
  for (const it of items) {
    const o = Number(it.orderedQuantity);
    const r = Number(it.receivedQuantity);
    if (Number.isFinite(o) && Number.isFinite(r) && r + 1e-9 < o) {
      parts.push(`${it.product.sku} Δ ${(o - r).toFixed(3)}`);
    }
  }
  return parts.length ? `Line gaps: ${parts.join("; ")}` : "";
}
