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
import { todayInAntananarivo } from "./lib/antananarivo-date.ts";
import { seedCatalogue } from "./data/catalogue.ts";
import { seedCustomersAndOrders } from "./data/customers-and-orders.ts";
import { assertDatabaseIsEmpty, truncateAllTables } from "./safety/database.ts";
import {
  destructiveSeedRefusals,
  optInFlagsDefinedByEnvFile,
  seedRefusals,
} from "./safety/destructive-guard.ts";
import { describeDatabaseTarget, loadRootEnvFile } from "./safety/environment.ts";
import { seedPlacesAndAxes } from "./data/places-and-axes.ts";
import { seedResellers } from "./data/resellers.ts";
import { seedSettings } from "./data/settings.ts";
import type { SeedContext } from "./lib/sql.ts";
import { seedStaff } from "./data/staff.ts";
import type { SeededStaff } from "./data/staff.ts";

const DEFAULT_ADMIN_USERNAME = "admin";

interface SeedConfiguration {
  readonly isReset: boolean;
  readonly databaseUrl: string;
  readonly target: string;
  readonly adminUsername: string;
}

function printLine(message: string): void {
  process.stdout.write(`${message}\n`);
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
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

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function refuseIfEnvFileDefinesFlags(shellEnvironment: NodeJS.ProcessEnv): void {
  const flagsFromEnvFile = optInFlagsDefinedByEnvFile(shellEnvironment, process.env);
  if (flagsFromEnvFile.length === 0) return;
  refuse(
    "Refusing to run: the .env file defines an opt-in flag.",
    flagsFromEnvFile.map((flag) => `${flag} is set in .env.`),
    "Remove it from .env and pass it on the command line, for one run only.",
  );
}

function refuseIfNotAllowed(isReset: boolean): void {
  const refusals = isReset ? destructiveSeedRefusals(process.env) : seedRefusals(process.env);
  if (refusals.length === 0) return;
  refuse(
    isReset ? "Refusing to reset the database:" : "Refusing to seed the database:",
    refusals,
    isReset
      ? "db:reset-and-seed erases every table. Run it only on a local throwaway database, with ALLOW_DESTRUCTIVE_SEED=true."
      : "The seed is meant for a local development database.",
  );
}

function readConfiguration(): SeedConfiguration {
  const isReset = process.argv.includes("--reset");
  const shellEnvironment = { ...process.env };
  loadRootEnvFile();
  refuseIfEnvFileDefinesFlags(shellEnvironment);

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    return fail("DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:up`.");
  }
  refuseIfNotAllowed(isReset);

  const configuredUsername = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const adminUsername =
    configuredUsername === undefined || configuredUsername === ""
      ? DEFAULT_ADMIN_USERNAME
      : configuredUsername;
  // Computed before anything can fail: it never throws and never shows the password.
  return { isReset, databaseUrl, target: describeDatabaseTarget(databaseUrl), adminUsername };
}

async function connect({ databaseUrl, target }: SeedConfiguration): Promise<Client> {
  try {
    // Building the client parses the URL, which can throw as well.
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    return client;
  } catch (error) {
    return fail(`Cannot connect to ${target}: ${describeError(error)}`);
  }
}

// One transaction: a failure leaves the database as it was.
async function seedInTransaction(client: Client, configuration: SeedConfiguration): Promise<void> {
  const now = new Date();
  await client.query("BEGIN");
  if (configuration.isReset) {
    await truncateAllTables(client);
  } else {
    await assertDatabaseIsEmpty(client);
  }
  const staff = await seedEverything(
    { db: client, now, today: todayInAntananarivo(now) },
    configuration.adminUsername,
  );
  await client.query("COMMIT");

  // The password comes first: nothing after the commit may keep it from being shown.
  printLine(`  Admin username: ${staff.adminUsername}`);
  printLine(`  Admin password: ${staff.adminPassword}`);
  printLine("");
  printLine("This password is shown only once and is not stored anywhere. Note it now.");
  printLine(`Demo data created in ${configuration.target}.`);
}

async function main(): Promise<void> {
  const configuration = readConfiguration();
  const client = await connect(configuration);
  try {
    await seedInTransaction(client, configuration);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    fail(describeError(error));
  } finally {
    await client.end();
  }
}

await main();
