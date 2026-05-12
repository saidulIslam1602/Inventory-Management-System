/**
 * Minimal CSV helpers for list exports (Excel-friendly UTF-8 with BOM).
 */

export function csvEscapeCell(value: unknown): string {
  if (value == null || value === "") return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(csvEscapeCell).join(","),
    ...rows.map((row) => row.map(csvEscapeCell).join(",")),
  ];
  return lines.join("\r\n") + "\r\n";
}

export function withUtf8Bom(csv: string): string {
  return `\uFEFF${csv}`;
}
