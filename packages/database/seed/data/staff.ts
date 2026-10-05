import { randomBytes } from "node:crypto";
import { hashPassword } from "../../src/password-hash.ts";
import { demoPhone } from "./config.ts";
import type { SeedContext } from "../lib/sql.ts";
import { insertRowAndReturnId } from "../lib/sql.ts";

export interface SeededStaff {
  readonly adminId: string;
  readonly adminUsername: string;
  // Returned to the caller only: it is printed once and never stored (only its hash is).
  readonly adminPassword: string;
}

function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

export async function seedStaff({ db }: SeedContext, adminUsername: string): Promise<SeededStaff> {
  const adminPassword = generatePassword();
  const adminId = await insertRowAndReturnId(db, "staff_user", {
    name: "Demo Admin",
    username: adminUsername,
    role: "ADMIN",
    password_hash: await hashPassword(adminPassword),
    active: true,
  });

  // The driver account is inactive and its password is thrown away: nobody can log in with it.
  await insertRowAndReturnId(db, "staff_user", {
    name: "Demo Driver",
    username: "demo-driver",
    phone: demoPhone(901),
    role: "DRIVER",
    password_hash: await hashPassword(generatePassword()),
    active: false,
  });

  return { adminId, adminUsername, adminPassword };
}
