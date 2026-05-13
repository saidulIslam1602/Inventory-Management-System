/**
 * OTLP exporter env helpers — shared by {@link ../node-otel.ts}.
 */

/** Parses `OTEL_EXPORTER_OTLP_HEADERS` (`key=value` pairs, comma-separated). */
export function parseOtlpHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw?.trim()) return undefined;
  const out: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}
