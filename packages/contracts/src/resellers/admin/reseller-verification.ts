/** A verification older than this is due again: the shop checks its resellers every quarter. */
export const RESELLER_VERIFICATION_MAX_AGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A reseller that was never verified (`null`) is stale. Pure: the caller gives the clock. */
export function isResellerVerificationStale(verifiedAt: Date | null, now: Date): boolean {
  if (verifiedAt === null) {
    return true;
  }
  return now.getTime() - verifiedAt.getTime() > RESELLER_VERIFICATION_MAX_AGE_DAYS * DAY_MS;
}
