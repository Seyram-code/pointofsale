/**
 * Ghana observes UTC+0 year-round with no DST, so calendar boundaries can be
 * computed directly in UTC without a timezone library.
 */

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function todayRange(): { from: Date; to: Date } {
  return { from: startOfDay(), to: endOfDay() };
}

export function yesterdayRange(): { from: Date; to: Date } {
  const yesterday = addDays(new Date(), -1);
  return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
}

/** Inclusive window ending today, e.g. `lastNDaysRange(7)` covers today and the six days before. */
export function lastNDaysRange(days: number): { from: Date; to: Date } {
  return { from: startOfDay(addDays(new Date(), -(days - 1))), to: endOfDay() };
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GH", { weekday: "short", timeZone: "UTC" }).format(date);
}

/** Percentage change from `previous` to `current`, guarding against divide-by-zero. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
