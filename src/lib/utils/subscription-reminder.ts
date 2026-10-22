function dateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function daysUntilSubscriptionExpiry(periodEnd: Date, now: Date, timeZone: string): number {
  const periodEndDate = dateKey(periodEnd, timeZone);
  const currentDate = dateKey(now, timeZone);
  return Math.round((Date.parse(`${periodEndDate}T00:00:00Z`) - Date.parse(`${currentDate}T00:00:00Z`)) / 86_400_000);
}

export function isSubscriptionReminderDay(daysRemaining: number): boolean {
  return Number.isInteger(daysRemaining) && daysRemaining >= 1 && daysRemaining <= 5;
}
