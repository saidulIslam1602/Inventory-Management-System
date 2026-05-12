/**
 * Next.js App Router: normalize `searchParams` values (string | string[] | undefined).
 */

export function searchParamFirst(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const s = value[0]?.trim();
    return s && s.length > 0 ? s : undefined;
  }
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

/** 1-based page index from URL (default 1). */
export function searchParamPage(value: string | string[] | undefined, fallback = 1): number {
  const raw = searchParamFirst(value);
  const n = raw !== undefined ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

/** Page size clamped to [minSize, maxSize]. */
export function searchParamPageSize(
  value: string | string[] | undefined,
  fallback = 50,
  minSize = 10,
  maxSize = 100
): number {
  const raw = searchParamFirst(value);
  const n = raw !== undefined ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(maxSize, Math.max(minSize, Math.floor(n)));
}

/** Serialize filters back into a query string (repeatable keys omitted). */
export function toQueryString(record: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined && v !== "") u.set(k, v);
  }
  return u.toString();
}
