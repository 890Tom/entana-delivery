import { dayInTimeZone } from "@entana/contracts";

import { INSTANCE_TIME_ZONE } from "../../../order-display/format-order";

const MS_PER_DAY = 86_400_000;

function dayNumber(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / MS_PER_DAY;
}

/**
 * Calendar days between the change and today, both read in the shop's time zone. A date after
 * the clock (a clock that is late) counts as today.
 */
export function daysUnavailable(changedAt: string, now: Date): number {
  const changedDay = dayInTimeZone(new Date(changedAt), INSTANCE_TIME_ZONE);
  const today = dayInTimeZone(now, INSTANCE_TIME_ZONE);
  return Math.max(0, dayNumber(today) - dayNumber(changedDay));
}
