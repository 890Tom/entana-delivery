// The delivery date is a day, never a time, read in the Indian/Antananarivo time zone
// (UTC+3, no daylight saving time). A day is written YYYY-MM-DD.
const SHOP_TIME_ZONE = "Indian/Antananarivo";

// The en-CA locale formats a date as YYYY-MM-DD.
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayInAntananarivo(now: Date): string {
  return dayFormatter.format(now);
}

export function addDays(day: string, days: number): string {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  if (year === undefined || month === undefined || dayOfMonth === undefined) {
    throw new RangeError(`Not a YYYY-MM-DD day: ${day}`);
  }
  // UTC arithmetic only: no daylight saving time can shift the result.
  const shifted = new Date(Date.UTC(year, month - 1, dayOfMonth + days));
  return shifted.toISOString().slice(0, 10);
}

// Madagascar is UTC+3 all year.
const UTC_OFFSET_HOURS = 3;

// The instant when the clock of Antananarivo shows `hour`:00 on the given day.
export function localHourOnDay(day: string, hour: number): Date {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  if (year === undefined || month === undefined || dayOfMonth === undefined) {
    throw new RangeError(`Not a YYYY-MM-DD day: ${day}`);
  }
  return new Date(Date.UTC(year, month - 1, dayOfMonth, hour - UTC_OFFSET_HOURS));
}
