// Fills an empty, migrated database with obviously fake demo data (docs/data-model.md).
//
//   pnpm db:seed             refuses in production, on a remote host (unless ALLOW_SEED_NON_LOCAL
//                            is "true") and if any table already has rows
//   pnpm db:reset-and-seed   the only destructive command, see destructive-guard.ts
//
// The admin password is random, printed once at the end and stored only as a hash. Run this in
// an interactive terminal, never in CI or a container whose output is kept, and not through
// Turborepo, which caches the output of the tasks it runs.
import { Client } from "pg";
import { todayInAntananarivo } from "./antananarivo-date.ts";
import { seedCatalogue } from "./catalogue.ts";
import { seedCustomersAndOrders } from "./customers-and-orders.ts";
import { assertDatabaseIsEmpty, truncateAllTables } from "./database.ts";
import {
  destructiveSeedRefusals,
  optInFlagsDefinedByEnvFile,
  seedRefusals,
} from "./destructive-guard.ts";
import { describeDatabaseTarget, loadRootEnvFile } from "./environment.ts";
import { seedPlacesAndAxes } from "./places-and-axes.ts";
import { seedResellers } from "./resellers.ts";
import { seedSettings } from "./settings.ts";
import type { SeedContext } from "./sql.ts";
import { seedStaff } from "./staff.ts";
import type { SeededStaff } from "./staff.ts";

const DEFAULT_ADMIN_USERNAME = "admin";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function seedEverything(context: SeedContext, adminUsername: string): Promise<SeededStaff> {
  await seedSettings(context);
  const products = await seedCatalogue(context);
  const geography = await seedPlacesAndAxes(context);
  const staff = await seedStaff(context, adminUsername);
  await seedCustomersAndOrders(context, products, geography, staff.adminId);
  await seedResellers(context);
  return staff;
}

function refuse(title: string, reasons: readonly string[], advice: string): never {
  return fail(`${title}\n${reasons.map((reason) => `- ${reason}`).join("\n")}\n${advice}`);
}

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");
  const shellEnvironment = { ...process.env };
  loadRootEnvFile();

  const flagsFromEnvFile = optInFlagsDefinedByEnvFile(shellEnvironment, process.env);
  if (flagsFromEnvFile.length > 0) {
    refuse(
      "Refusing to run: the .env file defines an opt-in flag.",
      flagsFromEnvFile.map((flag) => `${flag} is set in .env.`),
      "Remove it from .env and pass it on the command line, for one run only.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    fail("DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:up`.");
  }

  const refusals = reset ? destructiveSeedRefusals(process.env) : seedRefusals(process.env);
  if (refusals.length > 0) {
    refuse(
      reset ? "Refusing to reset the database:" : "Refusing to seed the database:",
      refusals,
      reset
        ? "db:reset-and-seed erases every table. Run it only on a local throwaway database, with ALLOW_DESTRUCTIVE_SEED=true."
        : "The seed is meant for a local development database.",
    );
  }
  // Computed once, before anything can fail: it never throws and never shows the password.
  const target = describeDatabaseTarget(databaseUrl);

  const configuredUsername = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const adminUsername =
    configuredUsername === undefined || configuredUsername === ""
      ? DEFAULT_ADMIN_USERNAME
      : configuredUsername;
  const now = new Date();
  let client: Client;
  try {
    // Building the client parses the URL, which can throw as well.
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  } catch (error) {
    fail(
      `Cannot connect to ${target}: ` + (error instanceof Error ? error.message : String(error)),
    );
  }
  try {
    // One transaction: a failure leaves the database as it was.
    await client.query("BEGIN");
    if (reset) {
      await truncateAllTables(client);
    } else {
      await assertDatabaseIsEmpty(client);
    }
    const staff = await seedEverything(
      { db: client, now, today: todayInAntananarivo(now) },
      adminUsername,
    );
    await client.query("COMMIT");

    // The password comes first: nothing after the commit may keep it from being shown.
    console.log(`  Admin username: ${staff.adminUsername}`);
    console.log(`  Admin password: ${staff.adminPassword}`);
    console.log("");
    console.log("This password is shown only once and is not stored anywhere. Note it now.");
    console.log(`Demo data created in ${target}.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    fail(error instanceof Error ? error.message : String(error));
  } finally {
    await client.end();
  }
}

await main();
