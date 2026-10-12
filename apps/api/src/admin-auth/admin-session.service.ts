import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_SESSION_TOUCH_INTERVAL_MS,
  computeSessionExpiry,
  evaluateAdminSession,
  shouldRecordSessionActivity,
} from "@entana/contracts";
import type { AdminProfile } from "@entana/contracts";
import { CLOCK } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { AdminUnauthenticatedError } from "./errors/admin-auth-errors.js";
import {
  findSessionByTokenHash,
  insertSessionAndPurge,
  revokeSessionByTokenHash,
  touchSession,
} from "./persistence/admin-auth-queries.js";
import type { AdminAuthDatabase, StoredAdminAccount } from "./persistence/admin-auth-queries.js";
import { generateSessionToken, hashSessionToken } from "./session/session-token.js";

export interface OpenedSession {
  /** The only place the token exists besides the cookie: it is never stored or answered. */
  readonly token: string;
  /** What the cookie lives for: the time left until the absolute end of the session. */
  readonly maxAgeSeconds: number;
}

// An account can open a session only if it is an active admin with an e-mail (a driver, a
// disabled account or an account without e-mail never can).
function isAdminAccount(account: StoredAdminAccount): boolean {
  return account.role === "ADMIN" && account.active && account.email !== null;
}

export function toAdminProfile(account: StoredAdminAccount): AdminProfile | undefined {
  if (!isAdminAccount(account) || account.email === null) {
    return undefined;
  }
  return { id: account.id, email: account.email, displayName: account.name };
}

/** The sessions of the administration: open, prove, close. */
@Injectable()
export class AdminSessionService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: AdminAuthDatabase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** A new session for each login: an existing token is never reused. */
  async open(staffUserId: string): Promise<OpenedSession> {
    const now = this.clock.now();
    const token = generateSessionToken();
    const expiresAt = computeSessionExpiry(now);
    await insertSessionAndPurge(this.db, {
      tokenHash: hashSessionToken(token),
      staffUserId,
      now,
      expiresAt,
    });
    return { token, maxAgeSeconds: Math.floor((expiresAt.getTime() - now.getTime()) / 1000) };
  }

  /** @throws AdminUnauthenticatedError for any session that cannot be used, whatever the cause. */
  async authenticate(token: string | undefined): Promise<AdminProfile> {
    if (token === undefined) {
      throw new AdminUnauthenticatedError();
    }
    const tokenHash = hashSessionToken(token);
    const session = await findSessionByTokenHash(this.db, tokenHash);
    const now = this.clock.now();
    const profile = session === null ? undefined : toAdminProfile(session.staffUser);
    if (
      session === null ||
      profile === undefined ||
      evaluateAdminSession(session, now) !== "valid"
    ) {
      throw new AdminUnauthenticatedError();
    }
    if (shouldRecordSessionActivity(session.lastSeenAt, now)) {
      const seenBefore = new Date(now.getTime() - ADMIN_SESSION_TOUCH_INTERVAL_MS);
      await touchSession(this.db, tokenHash, now, seenBefore);
    }
    return profile;
  }

  /** Idempotent: a missing, unknown or already revoked session is not an error. */
  async close(token: string | undefined): Promise<void> {
    if (token !== undefined) {
      await revokeSessionByTokenHash(this.db, hashSessionToken(token), this.clock.now());
    }
  }
}
