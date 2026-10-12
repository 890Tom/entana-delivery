import { validateAdminPassword } from "@entana/contracts";
import { createPrismaClient } from "@entana/database";
import { hashPassword } from "@entana/password-hash";
import { parseAdminUpsertArguments } from "./parse-admin-upsert-arguments.js";
import { createHiddenPrompt } from "./read-hidden-line.js";
import { upsertAdminAccount } from "./upsert-admin-account.js";
import type { AdminAccountOutcome } from "./upsert-admin-account.js";

// Fixed lines: nothing typed, no e-mail, no hash.
const OUTCOME_MESSAGES: Readonly<Record<AdminAccountOutcome, string>> = {
  created: "Account created.",
  "password-updated": "Password updated.",
  disabled: "Account disabled.",
  "not-found": "No account for this e-mail.",
};

async function readNewPassword(): Promise<string | undefined> {
  if (!process.stdin.isTTY) {
    process.stderr.write("The password must be typed on a terminal.\n");
    return undefined;
  }
  const prompt = createHiddenPrompt(process.stdin, process.stderr);
  try {
    const password = await prompt.ask("Password (12 to 128 characters): ");
    const again = await prompt.ask("Password again: ");
    if (password !== again) {
      process.stderr.write("The two entries differ.\n");
      return undefined;
    }
    const validation = validateAdminPassword(password);
    if (!validation.isValid) {
      process.stderr.write(
        validation.reason === "too-short"
          ? "The password must have at least 12 characters.\n"
          : "The password must have at most 128 characters.\n",
      );
      return undefined;
    }
    return password;
  } finally {
    prompt.close();
  }
}

async function main(): Promise<number> {
  const parsed = parseAdminUpsertArguments(process.argv.slice(2));
  if (!parsed.isValid) {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }
  const { email, displayName, isDisable } = parsed.arguments;
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    return 2;
  }
  let passwordHash: string | undefined;
  if (!isDisable) {
    const password = await readNewPassword();
    if (password === undefined) {
      return 1;
    }
    passwordHash = await hashPassword(password);
  }
  const client = createPrismaClient({ connectionString });
  try {
    const outcome = await upsertAdminAccount(client, {
      email,
      displayName,
      passwordHash,
      isDisable,
      now: new Date(),
    });
    process.stdout.write(`${OUTCOME_MESSAGES[outcome]}\n`);
    return outcome === "not-found" ? 1 : 0;
  } finally {
    await client.$disconnect();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    // Never print the error: a driver message can carry the connection string.
    process.stderr.write("The command failed.\n");
    process.exitCode = 1;
  },
);
