/**
 * Oslo-based reporting periods for charts (month / quarter / year + offset).
 */

import { toDate } from "date-fns-tz";
import { BUSINESS_TIME_ZONE } from "@/lib/business-calendar";
import { searchParamFirst } from "@/lib/search-params";

export type ChartPeriodMode = "month" | "quarter" | "year";

const MODES: readonly ChartPeriodMode[] = ["month", "quarter", "year"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function osloYmdParts(now: Date): { y: number; m: number; d: number } {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIME_ZONE });
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m: m || 1, d: d || 1 };
}

/** Last instant of calendar month `month` (1–12) in Europe/Oslo. */
function endOfOsloMonth(year: number, month: number): Date {
  const nextM = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  const startNext = toDate(`${nextY}-${pad2(nextM)}-01 00:00:00`, { timeZone: BUSINESS_TIME_ZONE });
  return new Date(startNext.getTime() - 1);
}

/** Inclusive UTC bounds for `createdAt` / timestamptz filters. */
export function osloPeriodUtcBounds(
  mode: ChartPeriodMode,
  offset: number,
  now: Date = new Date()
): { start: Date; end: Date } {
  const { y, m } = osloYmdParts(now);

  if (mode === "year") {
    const ty = y - offset;
    return {
      start: toDate(`${ty}-01-01 00:00:00`, { timeZone: BUSINESS_TIME_ZONE }),
      end: toDate(`${ty}-12-31 23:59:59.999`, { timeZone: BUSINESS_TIME_ZONE }),
    };
  }

  if (mode === "quarter") {
    const q = Math.floor((m - 1) / 3);
    let tq = q - offset;
    let ty = y;
    while (tq < 0) {
      tq += 4;
      ty -= 1;
    }
    while (tq > 3) {
      tq -= 4;
      ty += 1;
    }
    const startM = tq * 3 + 1;
    const endM = startM + 2;
    return {
      start: toDate(`${ty}-${pad2(startM)}-01 00:00:00`, { timeZone: BUSINESS_TIME_ZONE }),
      end: endOfOsloMonth(ty, endM),
    };
  }

  let tm = m - offset;
  let ty = y;
  while (tm < 1) {
    tm += 12;
    ty -= 1;
  }
  while (tm > 12) {
    tm -= 12;
    ty += 1;
  }
  return {
    start: toDate(`${ty}-${pad2(tm)}-01 00:00:00`, { timeZone: BUSINESS_TIME_ZONE }),
    end: endOfOsloMonth(ty, tm),
  };
}

export function osloPeriodYmdRange(
  mode: ChartPeriodMode,
  offset: number,
  now: Date = new Date()
): { startYmd: string; endYmd: string } {
  const { start, end } = osloPeriodUtcBounds(mode, offset, now);
  return {
    startYmd: start.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIME_ZONE }),
    endYmd: end.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIME_ZONE }),
  };
}

export function parseChartPeriod(sp: Record<string, string | string[] | undefined>): {
  mode: ChartPeriodMode;
  offset: number;
} {
  const raw = searchParamFirst(sp.period)?.toLowerCase();
  const mode: ChartPeriodMode = MODES.includes(raw as ChartPeriodMode)
    ? (raw as ChartPeriodMode)
    : "month";
  const offRaw = searchParamFirst(sp.offset);
  let offset = offRaw !== undefined ? Number.parseInt(offRaw, 10) : 0;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  if (offset > 120) offset = 120;
  return { mode, offset };
}

/** Short label for UI (Norwegian). */
export function formatChartPeriodTitle(
  mode: ChartPeriodMode,
  offset: number,
  now: Date = new Date()
): string {
  const { startYmd } = osloPeriodYmdRange(mode, offset, now);
  const [sy, sm] = startYmd.split("-").map(Number);
  if (mode === "year") return `År ${sy}`;
  if (mode === "quarter") {
    const q = Math.floor(((sm || 1) - 1) / 3) + 1;
    return `Q${q} ${sy}`;
  }
  const d = new Date(Date.UTC(sy, (sm || 1) - 1, 1));
  return d.toLocaleDateString("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatChartPeriodRangeDetail(
  mode: ChartPeriodMode,
  offset: number,
  now: Date = new Date()
): string {
  const { startYmd, endYmd } = osloPeriodYmdRange(mode, offset, now);
  const a = prismaDateStringToNb(startYmd);
  const b = prismaDateStringToNb(endYmd);
  return `${a} – ${b}`;
}

function prismaDateStringToNb(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return dt.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
