import { dayInTimeZone, formatNationalNumber } from "@entana/contracts";

/**
 * The time zone of the shop. The public configuration does not publish it (it stays on the
 * server), so the administration reads times in the zone of the only deployment there is today.
 */
const INSTANCE_TIME_ZONE = "Indian/Antananarivo";

const NO_BREAK_SPACE = " ";
const THOUSANDS_GROUP = /\B(?=(\d{3})+(?!\d))/g;

/** "8 500 Ar": the space is a no-break one, so that an amount never wraps in the middle. */
export function formatAmount(amountAr: number): string {
  return `${String(amountAr).replace(THOUSANDS_GROUP, NO_BREAK_SPACE)}${NO_BREAK_SPACE}Ar`;
}

/** "10 h 12": the hour and the minutes of an instant, in the time zone of the shop. */
export function formatTime(instant: string): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: INSTANCE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("hour")} h ${read("minute")}`;
}

/** "ven. 2 oct.": a calendar day (YYYY-MM-DD) is written as it is, with no zone conversion. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** The day, today for the shop, as YYYY-MM-DD. */
export function todayInShop(now: Date): string {
  return dayInTimeZone(now, INSTANCE_TIME_ZONE);
}

/**
 * "034 00 000 00" from "+261340000000": the national form, with the trunk zero people dial. A
 * number that does not start with the country code is shown as it is.
 */
export function formatPhone(phoneE164: string, countryCode: string): string {
  const prefix = `+${countryCode}`;
  if (!phoneE164.startsWith(prefix)) {
    return phoneE164;
  }
  const national = phoneE164.slice(prefix.length);
  return `0${formatNationalNumber(national, countryCode)}`;
}
