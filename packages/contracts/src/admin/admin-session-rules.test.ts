import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_IDLE_TIMEOUT_MS,
  ADMIN_SESSION_LIFETIME_MS,
  ADMIN_SESSION_TOUCH_INTERVAL_MS,
  computeSessionExpiry,
  evaluateAdminSession,
  shouldRecordSessionActivity,
} from "./admin-session-rules.js";

const START = new Date("2026-10-12T08:00:00.000Z");
const at = (offsetMs: number): Date => new Date(START.getTime() + offsetMs);

const freshSession = {
  expiresAt: at(ADMIN_SESSION_LIFETIME_MS),
  lastSeenAt: START,
  revokedAt: null,
};

describe("evaluateAdminSession", () => {
  it("accepts a session that is neither expired, idle nor revoked", () => {
    expect(evaluateAdminSession(freshSession, at(60_000))).toBe("valid");
  });

  it("refuses a session after its absolute expiry, even if it was used a second ago", () => {
    const session = { ...freshSession, lastSeenAt: at(ADMIN_SESSION_LIFETIME_MS - 1000) };
    expect(evaluateAdminSession(session, at(ADMIN_SESSION_LIFETIME_MS))).toBe("expired");
  });

  it("accepts a session one millisecond before its absolute expiry", () => {
    const session = { ...freshSession, lastSeenAt: at(ADMIN_SESSION_LIFETIME_MS - 1000) };
    expect(evaluateAdminSession(session, at(ADMIN_SESSION_LIFETIME_MS - 1))).toBe("valid");
  });

  it("refuses a session that was not seen for 12 hours", () => {
    expect(evaluateAdminSession(freshSession, at(ADMIN_SESSION_IDLE_TIMEOUT_MS))).toBe("idle");
  });

  it("accepts a session one millisecond before the inactivity limit", () => {
    expect(evaluateAdminSession(freshSession, at(ADMIN_SESSION_IDLE_TIMEOUT_MS - 1))).toBe("valid");
  });

  it("refuses a revoked session first, whatever its dates", () => {
    const session = { ...freshSession, revokedAt: at(1000) };
    expect(evaluateAdminSession(session, at(2000))).toBe("revoked");
  });
});

describe("computeSessionExpiry", () => {
  it("is 7 days after the creation", () => {
    expect(computeSessionExpiry(START).toISOString()).toBe("2026-10-19T08:00:00.000Z");
  });
});

describe("shouldRecordSessionActivity", () => {
  it("does not write again within a minute of the last record", () => {
    expect(shouldRecordSessionActivity(START, at(ADMIN_SESSION_TOUCH_INTERVAL_MS - 1))).toBe(false);
  });

  it("writes once a minute has passed", () => {
    expect(shouldRecordSessionActivity(START, at(ADMIN_SESSION_TOUCH_INTERVAL_MS))).toBe(true);
  });
});
