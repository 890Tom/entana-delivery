import type { AdminReseller } from "@entana/contracts";

import { INSTANCE_TIME_ZONE } from "../../../order-display/format-order";

import { daysSince } from "./reseller-list";

export type VerificationView =
  | { readonly kind: "never" }
  | { readonly kind: "verified"; readonly date: string; readonly days: number };

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: INSTANCE_TIME_ZONE,
});

/** The last verification of a reseller: the day it was made (in the shop's time zone) and its age. */
export function verificationViewOf(reseller: AdminReseller, now: Date): VerificationView {
  if (reseller.verifiedAt === null) {
    return { kind: "never" };
  }
  return {
    kind: "verified",
    date: DATE_FORMAT.format(new Date(reseller.verifiedAt)),
    days: daysSince(reseller.verifiedAt, now),
  };
}
