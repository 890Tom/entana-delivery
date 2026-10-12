import { dayInTimeZone } from "@entana/contracts";

import { INSTANCE_TIME_ZONE, formatTime, todayInShop } from "../../orders/rules/format-order";

import { addDays } from "./delivery-days";

type DayRelation = "today" | "yesterday" | "other";

export interface InstantView {
  readonly relation: DayRelation;
  /** "9 h 47", in the zone of the shop. */
  readonly time: string;
  /** "28 sept.", in the zone of the shop. */
  readonly date: string;
}

/** "sam. 3 octobre": a calendar day (YYYY-MM-DD) is written as it is, with no zone conversion. */
export function formatLongDay(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(`${day}T00:00:00Z`));
}

function formatShortDate(instant: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: INSTANCE_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(instant));
}

function relationOf(instant: string, now: Date): DayRelation {
  const day = dayInTimeZone(new Date(instant), INSTANCE_TIME_ZONE);
  const today = todayInShop(now);
  if (day === today) {
    return "today";
  }
  return day === addDays(today, -1) ? "yesterday" : "other";
}

/** What the sheet needs to say when an instant happened, relative to `now`. */
export function describeInstant(instant: string, now: Date): InstantView {
  return {
    relation: relationOf(instant, now),
    time: formatTime(instant),
    date: formatShortDate(instant),
  };
}

/** The time of a history line: the time alone for today, the date before it otherwise. */
export function formatEventTime(view: InstantView): string {
  return view.relation === "today" ? view.time : `${view.date} · ${view.time}`;
}
