const DAY_MS = 86_400_000;

// The shift of the time zone at an instant: the wall clock read as if it were UTC, minus the
// instant itself (rounded down to the second, which is all the wall clock shows).
function offsetMilliseconds(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const wallClockAsUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// Read twice, so that a day on which the shift changes still starts at the right instant.
function startOfDay(day: string, timeZone: string): Date {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  const firstGuess = utcMidnight - offsetMilliseconds(new Date(utcMidnight), timeZone);
  return new Date(utcMidnight - offsetMilliseconds(new Date(firstGuess), timeZone));
}

/** The instants where a calendar day (YYYY-MM-DD) of a time zone starts and ends (excluded). */
export function dayBoundsInTimeZone(
  day: string,
  timeZone: string,
): { readonly start: Date; readonly end: Date } {
  const nextDay = new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  return { start: startOfDay(day, timeZone), end: startOfDay(nextDay, timeZone) };
}
