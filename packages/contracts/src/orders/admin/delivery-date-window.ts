/** How far ahead the shop may schedule a delivery, in days from today. */
export const MAX_DELIVERY_DAYS_AHEAD = 60;

const DAY_MS = 86_400_000;

/** The calendar day (YYYY-MM-DD) of an instant in a time zone: the shop's "today". */
export function dayInTimeZone(instant: Date, timeZone: string): string {
  // The Swedish format is the ISO one: year, month and day, hyphenated.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Both arguments are plain days (YYYY-MM-DD): from today up to `MAX_DELIVERY_DAYS_AHEAD` later. */
export function isDeliveryDateInWindow(day: string, today: string): boolean {
  const daysAhead = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS;
  return daysAhead >= 0 && daysAhead <= MAX_DELIVERY_DAYS_AHEAD;
}
