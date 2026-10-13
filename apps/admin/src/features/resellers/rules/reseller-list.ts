import { dayInTimeZone, isResellerVerificationStale } from "@entana/contracts";
import type { AdminReseller } from "@entana/contracts";

import { INSTANCE_TIME_ZONE } from "../../../order-display/format-order";

export const RESELLER_TABS = ["all", "active", "inactive", "stale"] as const;

export type ResellerTab = (typeof RESELLER_TABS)[number];

export interface ResellerCounts {
  readonly total: number;
  readonly active: number;
  readonly inactive: number;
  readonly stale: number;
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30;

/** A reseller that was never verified, or not for more than 90 days. */
export function isStale(reseller: AdminReseller, now: Date): boolean {
  const verifiedAt = reseller.verifiedAt === null ? null : new Date(reseller.verifiedAt);
  return isResellerVerificationStale(verifiedAt, now);
}

export function countResellers(resellers: readonly AdminReseller[], now: Date): ResellerCounts {
  const active = resellers.filter((reseller) => reseller.visible).length;
  return {
    total: resellers.length,
    active,
    inactive: resellers.length - active,
    stale: resellers.filter((reseller) => isStale(reseller, now)).length,
  };
}

const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / MS_PER_DAY;

/** Calendar days since an instant, both read in the shop's time zone; never negative. */
export function daysSince(instant: string, now: Date): number {
  const day = dayInTimeZone(new Date(instant), INSTANCE_TIME_ZONE);
  const today = dayInTimeZone(now, INSTANCE_TIME_ZONE);
  return Math.max(0, dayNumber(today) - dayNumber(day));
}

/** Whole months of 30 days; null for a reseller that was never verified. */
export function staleMonths(reseller: AdminReseller, now: Date): number | null {
  if (reseller.verifiedAt === null) {
    return null;
  }
  return Math.floor(daysSince(reseller.verifiedAt, now) / DAYS_PER_MONTH);
}

function matchesTab(reseller: AdminReseller, tab: ResellerTab, now: Date): boolean {
  switch (tab) {
    case "all":
      return true;
    case "active":
      return reseller.visible;
    case "inactive":
      return !reseller.visible;
    case "stale":
      return isStale(reseller, now);
  }
}

function matchesSearch(reseller: AdminReseller, term: string): boolean {
  if (term === "") {
    return true;
  }
  const needle = term.toLocaleLowerCase("fr");
  return [reseller.name, reseller.neighborhood].some((text) =>
    text.toLocaleLowerCase("fr").includes(needle),
  );
}

/** The rows to show, in the order of the API: the client never sorts. */
export function visibleResellers(
  resellers: readonly AdminReseller[],
  tab: ResellerTab,
  search: string,
  now: Date,
): readonly AdminReseller[] {
  const term = search.trim();
  return resellers.filter(
    (reseller) => matchesTab(reseller, tab, now) && matchesSearch(reseller, term),
  );
}
