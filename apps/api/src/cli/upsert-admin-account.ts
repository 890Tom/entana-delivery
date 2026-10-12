import type { PrismaClient } from "@entana/database";

export type AdminAccountDatabase = Pick<
  PrismaClient,
  "$transaction" | "adminSession" | "staffUser"
>;

export interface AdminAccountChange {
  readonly email: string;
  readonly displayName: string | undefined;
  /** Absent only when the account is being disabled. */
  readonly passwordHash: string | undefined;
  readonly isDisable: boolean;
  readonly now: Date;
}

export type AdminAccountOutcome = "created" | "password-updated" | "disabled" | "not-found";

/**
 * Creates an admin account, changes its password, or disables it. Whatever changes the ability to
 * log in also revokes the sessions of the account: a new password must end the sessions opened
 * with the old one. Setting a password on a disabled account enables it again.
 */
export async function upsertAdminAccount(
  db: AdminAccountDatabase,
  change: AdminAccountChange,
): Promise<AdminAccountOutcome> {
  return db.$transaction(async (transaction) => {
    const existing = await transaction.staffUser.findUnique({
      where: { email: change.email },
      select: { id: true },
    });
    if (change.isDisable || change.passwordHash === undefined) {
      return disable(transaction, existing?.id, change.now);
    }
    if (existing === null) {
      await transaction.staffUser.create({
        data: {
          email: change.email,
          username: change.email,
          name: change.displayName ?? change.email.split("@")[0] ?? change.email,
          role: "ADMIN",
          passwordHash: change.passwordHash,
          active: true,
        },
      });
      return "created";
    }
    await transaction.staffUser.update({
      where: { id: existing.id },
      data: {
        passwordHash: change.passwordHash,
        active: true,
        ...(change.displayName === undefined ? {} : { name: change.displayName }),
      },
    });
    await revokeSessions(transaction, existing.id, change.now);
    return "password-updated";
  });
}

async function disable(
  transaction: Pick<AdminAccountDatabase, "adminSession" | "staffUser">,
  staffUserId: string | undefined,
  now: Date,
): Promise<AdminAccountOutcome> {
  if (staffUserId === undefined) {
    return "not-found";
  }
  await transaction.staffUser.update({ where: { id: staffUserId }, data: { active: false } });
  await revokeSessions(transaction, staffUserId, now);
  return "disabled";
}

async function revokeSessions(
  transaction: Pick<AdminAccountDatabase, "adminSession">,
  staffUserId: string,
  now: Date,
): Promise<void> {
  await transaction.adminSession.updateMany({
    where: { staffUserId, revokedAt: null },
    data: { revokedAt: now },
  });
}
