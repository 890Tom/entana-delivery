import { ADMIN_SESSION_IDLE_TIMEOUT_MS } from "@entana/contracts";
import type { PrismaClient, StaffRole } from "@entana/database";

/** What the admin authentication needs from the database client: the PrismaClient fits. */
export type AdminAuthDatabase = Pick<PrismaClient, "$transaction" | "adminSession" | "staffUser">;

export interface StoredAdminAccount {
  readonly id: string;
  readonly email: string | null;
  readonly name: string;
  readonly role: StaffRole;
  readonly active: boolean;
}

export interface StoredLoginAccount extends StoredAdminAccount {
  readonly passwordHash: string;
}

export interface StoredSession {
  readonly expiresAt: Date;
  readonly lastSeenAt: Date;
  readonly revokedAt: Date | null;
  readonly staffUser: StoredAdminAccount;
}

const ACCOUNT_FIELDS = { id: true, email: true, name: true, role: true, active: true } as const;

export function findAccountByEmail(
  db: AdminAuthDatabase,
  email: string,
): Promise<StoredLoginAccount | null> {
  return db.staffUser.findUnique({
    where: { email },
    select: { ...ACCOUNT_FIELDS, passwordHash: true },
  });
}

export function findSessionByTokenHash(
  db: AdminAuthDatabase,
  tokenHash: string,
): Promise<StoredSession | null> {
  return db.adminSession.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      lastSeenAt: true,
      revokedAt: true,
      staffUser: { select: ACCOUNT_FIELDS },
    },
  });
}

export interface NewSession {
  readonly tokenHash: string;
  readonly staffUserId: string;
  readonly now: Date;
  readonly expiresAt: Date;
}

/**
 * Stores a new session and, in the same transaction, deletes the sessions that can no longer be
 * used (expired, idle for 12 hours or revoked): there is no scheduled task to do it.
 */
export async function insertSessionAndPurge(
  db: AdminAuthDatabase,
  session: NewSession,
): Promise<void> {
  const idleBefore = new Date(session.now.getTime() - ADMIN_SESSION_IDLE_TIMEOUT_MS);
  await db.$transaction([
    db.adminSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: session.now } },
          { lastSeenAt: { lte: idleBefore } },
          { revokedAt: { not: null } },
        ],
      },
    }),
    db.adminSession.create({
      data: {
        tokenHash: session.tokenHash,
        staffUserId: session.staffUserId,
        createdAt: session.now,
        lastSeenAt: session.now,
        expiresAt: session.expiresAt,
      },
    }),
  ]);
}

/**
 * Records the activity of a session unless another request just did: the condition is in the
 * statement, so concurrent requests write once.
 */
export async function touchSession(
  db: AdminAuthDatabase,
  tokenHash: string,
  now: Date,
  seenBefore: Date,
): Promise<void> {
  await db.adminSession.updateMany({
    where: { tokenHash, lastSeenAt: { lte: seenBefore } },
    data: { lastSeenAt: now },
  });
}

export async function revokeSessionByTokenHash(
  db: AdminAuthDatabase,
  tokenHash: string,
  now: Date,
): Promise<void> {
  await db.adminSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: now },
  });
}
