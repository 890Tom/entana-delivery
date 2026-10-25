import { dayInTimeZone } from "@entana/contracts";

/**
 * Today in the shop's time zone, in the form Prisma gives a `DATE` column: midnight UTC of that day.
 * The delivery date is a plain day, so it is compared with a day and never with an instant.
 */
export function todayAsDeliveryDate(now: Date, timeZone: string): Date {
  return new Date(`${dayInTimeZone(now, timeZone)}T00:00:00.000Z`);
}
