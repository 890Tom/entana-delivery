import { isDeliveryDateInWindow, MAX_DELIVERY_DAYS_AHEAD } from "@entana/contracts";

const DAY_MS = 86_400_000;
const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type QuickDayKey = "today" | "tomorrow" | "dayAfter";

export interface QuickDay {
  readonly key: QuickDayKey;
  /** YYYY-MM-DD, a calendar day of the shop. */
  readonly day: string;
}

/** A plain day (YYYY-MM-DD) moved by whole days, with no time zone in the way. */
export function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10);
}

/** The three quick choices, counted from today in the zone of the shop. */
export function buildQuickDays(today: string): readonly QuickDay[] {
  return [
    { key: "today", day: today },
    { key: "tomorrow", day: addDays(today, 1) },
    { key: "dayAfter", day: addDays(today, 2) },
  ];
}

/** The bounds given to the native date picker. */
export function deliveryWindow(today: string): { readonly min: string; readonly max: string } {
  return { min: today, max: addDays(today, MAX_DELIVERY_DAYS_AHEAD) };
}

/** A day typed by hand can be anything: the window of `contracts` decides, as the server does. */
export function isChoosableDay(day: string, today: string): boolean {
  return PLAIN_DAY.test(day) && isDeliveryDateInWindow(day, today);
}

export type DaySelection =
  { readonly kind: "quick"; readonly key: QuickDayKey } | { readonly kind: "other" };

export interface ChosenDay {
  /** The day the shop picked, or null while there is none that can be sent. */
  readonly day: string | null;
  /** A day was typed and it is outside the window: say so. */
  readonly isInvalid: boolean;
}

/** What the day picker holds, as the day to confirm (nothing is chosen by default). */
export function resolveChosenDay(
  selection: DaySelection | null,
  otherDay: string,
  today: string,
): ChosenDay {
  if (selection === null) {
    return { day: null, isInvalid: false };
  }
  if (selection.kind === "quick") {
    const quick = buildQuickDays(today).find((candidate) => candidate.key === selection.key);
    return { day: quick?.day ?? null, isInvalid: false };
  }
  if (otherDay === "") {
    return { day: null, isInvalid: false };
  }
  return isChoosableDay(otherDay, today)
    ? { day: otherDay, isInvalid: false }
    : { day: null, isInvalid: true };
}
