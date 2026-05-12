/**
 * Business calendar — Aqila operates in Norway; attendance and daily KPIs must use
 * Europe/Oslo calendar dates, not the server's default timezone.
 *
 * Prisma `@db.Date` / PostgreSQL DATE pair cleanly with a Date at UTC midnight whose
 * Y-M-D matches the Oslo calendar day (same pattern as prisma/seed.ts attendance).
 */

import { toDate } from "date-fns-tz";

export const BUSINESS_TIME_ZONE = "Europe/Oslo";

/**
 * “Last N days” movement charts: N inclusive Oslo calendar days through now (not N×24h rolling).
 * SQL subtracts (N − 1) from start of today in Oslo to get the lower bound instant.
 */
export const MOVEMENT_CHART_CALENDAR_DAYS = 30;

export function osloYmd(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIME_ZONE });
}

/**
 * Prisma/Postgres DATE for one Oslo calendar day: UTC midnight on that Y-M-D
 * (stable compare for `date: { equals }` on `@db.Date`).
 */
export function prismaDateForOsloCalendarDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  if (!y || !m || !d) throw new Error(`Invalid YMD: ${ymd}`);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Today's row(s) on the attendance `date` column (Oslodag). */
export function todayOsloPrismaDate(now: Date = new Date()): Date {
  return prismaDateForOsloCalendarDay(osloYmd(now));
}

/** First / last calendar day of the month containing `now`, as Prisma DATE sentinels. */
export function osloMonthDateRangePrisma(now: Date = new Date()): { start: Date; end: Date } {
  const ymd = osloYmd(now);
  const [yStr, mStr] = ymd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start, end };
}

/** Move a Prisma DATE sentinel by whole calendar days (UTC date components). */
export function addCalendarDaysPrismaDate(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Inclusive Oslo calendar Y-M-D strings → UTC instants for `DateTime` / timestamptz
 * Prisma filters (`createdAt`, etc.).
 */
export function osloYmdRangeToUtcBounds(
  fromYmd?: string,
  toYmd?: string
): { gte?: Date; lte?: Date } {
  const r: { gte?: Date; lte?: Date } = {};
  if (fromYmd && /^\d{4}-\d{2}-\d{2}$/.test(fromYmd)) {
    r.gte = toDate(`${fromYmd} 00:00:00`, { timeZone: BUSINESS_TIME_ZONE });
  }
  if (toYmd && /^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    r.lte = toDate(`${toYmd} 23:59:59.999`, { timeZone: BUSINESS_TIME_ZONE });
  }
  return r;
}
