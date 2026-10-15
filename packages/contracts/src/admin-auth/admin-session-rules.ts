/** A session lives 7 days at most, whatever its use. */
export const ADMIN_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60_000;
/** A session that was not used for 12 hours is over. */
export const ADMIN_SESSION_IDLE_TIMEOUT_MS = 12 * 60 * 60_000;
/** `last_seen_at` is written at most this often, so that a request is not a write. */
export const ADMIN_SESSION_TOUCH_INTERVAL_MS = 60_000;

export type AdminSessionState = "valid" | "expired" | "idle" | "revoked";

export interface AdminSessionDates {
  readonly expiresAt: Date;
  readonly lastSeenAt: Date;
  readonly revokedAt: Date | null;
}

/** Why a stored session can or cannot be used at `now`. Revocation is checked first. */
export function evaluateAdminSession(session: AdminSessionDates, now: Date): AdminSessionState {
  if (session.revokedAt !== null) {
    return "revoked";
  }
  if (now.getTime() >= session.expiresAt.getTime()) {
    return "expired";
  }
  if (now.getTime() - session.lastSeenAt.getTime() >= ADMIN_SESSION_IDLE_TIMEOUT_MS) {
    return "idle";
  }
  return "valid";
}

export function computeSessionExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + ADMIN_SESSION_LIFETIME_MS);
}

export function shouldRecordSessionActivity(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= ADMIN_SESSION_TOUCH_INTERVAL_MS;
}
