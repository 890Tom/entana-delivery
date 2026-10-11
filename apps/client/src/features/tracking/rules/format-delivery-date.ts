const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// The day is a calendar date, not an instant: it is read as UTC midnight and written in UTC, so
// that no time zone of the device can move it by a day.
const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "2026-10-02" gives "vendredi 2 octobre", whatever the time zone of the device. */
export function formatDeliveryDate(day: string): string {
  const parts = DAY_PATTERN.exec(day);
  if (parts === null) {
    return day;
  }
  const [, year, month, date] = parts;
  return DAY_FORMAT.format(Date.UTC(Number(year), Number(month) - 1, Number(date)));
}

/** "Vendredi 2 octobre": the same day, at the start of a line. */
export function formatDeliveryDateTitle(day: string): string {
  const text = formatDeliveryDate(day);
  return `${text.charAt(0).toLocaleUpperCase("fr-FR")}${text.slice(1)}`;
}
