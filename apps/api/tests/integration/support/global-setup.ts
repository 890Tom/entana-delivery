import { createPrismaClient } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import type { TestProject } from "vitest/node";
import { applyMigrations } from "./apply-migrations.js";
import { countRows, findChangedTables } from "./count-rows.js";
import type { RowCounts } from "./count-rows.js";
import type { SchemaObjects } from "./forbidden-strings.js";
import { classifyDatabaseHost } from "./host-guard.js";
import { cleanUpOnSignal } from "./interrupt-cleanup.js";
import { readSchemaObjects, requireEnoughTables } from "./schema-objects.js";
import { SetupError } from "./setup-error.js";
import { generateThrowawayDatabaseName, isThrowawayDatabaseName } from "./throwaway-database.js";

declare module "vitest" {
  export interface ProvidedContext {
    /** Name of the database created for this run: `test_` and lowercase hex. */
    throwawayDatabase: string;
    /** Points at the throwaway database. Holds the password. */
    throwawayConnectionString: string;
    /** The configured database, for read-only checks that it is refused. Holds the password. */
    configuredDatabaseUrl: string;
    schemaObjects: SchemaObjects;
  }
}

const REMOTE_DATABASE_OVERRIDE = "ENTANA_ALLOW_REMOTE_TEST_DB";
const REACHABILITY_TIMEOUT_MS = 3000;
// Always present on a PostgreSQL server: the connection that creates and drops the throwaway one.
const MAINTENANCE_DATABASE = "postgres";

// Node and Prisma 7 do not read .env files: the root .env is loaded here, as in prisma.config.ts.
// A missing file is fine: in CI the variables come from the environment.
function loadRootEnvFile(): void {
  try {
    process.loadEnvFile(new URL("../../../../../.env", import.meta.url));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

function requireDatabaseUrl(): string {
  loadRootEnvFile();
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    throw new SetupError(
      "DATABASE_URL is not set. Copy .env.example to .env and start PostgreSQL with `pnpm db:up`.",
    );
  }
  requireLocalDatabase(databaseUrl);
  return databaseUrl;
}

function requireLocalDatabase(databaseUrl: string): void {
  const kind = classifyDatabaseHost(databaseUrl);
  if (kind === "invalid") {
    throw new SetupError("DATABASE_URL is not a valid URL.");
  }
  if (kind === "remote" && process.env[REMOTE_DATABASE_OVERRIDE] !== "1") {
    throw new SetupError(
      `Refusing to run: the database host is not local. Set ${REMOTE_DATABASE_OVERRIDE}=1 only for a database that is meant for tests.`,
    );
  }
}

// Host and port only: the connection string holds the password and must never be printed.
function describeDatabaseTarget(databaseUrl: string): string {
  const { hostname, port } = new URL(databaseUrl);
  return `${hostname}:${port}`;
}

// The URL of another database of the same server, derived without printing any part of the original.
function withDatabase(databaseUrl: string, database: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function requireReachableDatabase(admin: PrismaClient, databaseUrl: string): Promise<void> {
  try {
    await admin.$queryRaw`SELECT 1`;
  } catch {
    // Never skip silently, in CI as well as locally. The original error is dropped on purpose:
    // it can quote the connection string.
    throw new SetupError(
      `PostgreSQL is not reachable at ${describeDatabaseTarget(databaseUrl)}. Start it with \`pnpm db:up\`.`,
    );
  }
}

// Mutable on purpose: it records how far the setup got, so that the cleanup does only what is needed.
interface Run {
  readonly name: string;
  /** Connected to the maintenance database: creates and drops the throwaway one. */
  readonly admin: PrismaClient;
  /** Connected to the configured database, for read-only row counts only. */
  readonly configured: PrismaClient;
  throwaway: PrismaClient | undefined;
  isCreated: boolean;
  rowsBefore: RowCounts | undefined;
}

// A step that fails for a reason of its own (a driver error can quote the connection string or
// the SQL) is reported by name only.
async function runStep<T>(step: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof SetupError) {
      throw error;
    }
    throw new SetupError(`The test setup failed while ${step}.`);
  }
}

// The role must be allowed to create the throwaway database: fail early with a clear message.
async function requireCreateDatabasePrivilege(admin: PrismaClient): Promise<void> {
  const rows = await admin.$queryRaw<
    { allowed: boolean }[]
  >`SELECT (rolcreatedb OR rolsuper) AS allowed FROM pg_roles WHERE rolname = current_user`;
  if (rows[0]?.allowed !== true) {
    throw new SetupError(
      "The database role of DATABASE_URL cannot create databases (CREATEDB is required to run this suite).",
    );
  }
}

// CREATE and DROP run on the maintenance database, where assertThrowawayDatabase cannot apply:
// the name is checked here instead, because it ends up in a statement and in a session kill.
function requireThrowawayName(name: string): void {
  if (!isThrowawayDatabaseName(name)) {
    throw new SetupError("The throwaway database name does not match test_ and lowercase hex.");
  }
}

async function createDatabase(admin: PrismaClient, name: string): Promise<void> {
  requireThrowawayName(name);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
}

async function dropDatabase(admin: PrismaClient, name: string): Promise<void> {
  requireThrowawayName(name);
  await admin.$executeRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${name} AND pid <> pg_backend_pid()`;
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}"`);
}

async function requireDatabaseGone(admin: PrismaClient, name: string): Promise<void> {
  const rows = await admin.$queryRaw<
    { found: number }[]
  >`SELECT 1 AS found FROM pg_database WHERE datname = ${name}`;
  if (rows.length > 0) {
    throw new SetupError("The throwaway database still exists after the teardown.");
  }
}

async function requireConfiguredDatabaseUnchanged(run: Run): Promise<void> {
  if (run.rowsBefore === undefined) {
    return;
  }
  const changed = findChangedTables(run.rowsBefore, await countRows(run.configured));
  if (changed.length > 0) {
    throw new SetupError(
      `The row counts of the configured database changed (tables: ${changed.join(", ")}). Either a test did not use the throwaway database, or something else wrote to the configured database during the run (a running development server, for example).`,
    );
  }
}

async function attempt(step: string, action: () => Promise<void>): Promise<SetupError | undefined> {
  try {
    await runStep(step, action);
    return undefined;
  } catch (error) {
    return error instanceof SetupError ? error : new SetupError(`The teardown failed: ${step}.`);
  }
}

// Also the cleanup of a failed setup. Every step runs whatever the previous one did, so that one
// failure never hides another, and every client is closed so that the process can exit.
async function finishRun(run: Run, stopListeningToSignals: () => void): Promise<void> {
  stopListeningToSignals();
  const failures: (SetupError | undefined)[] = [];
  try {
    failures.push(
      await attempt("closing the throwaway client", async () => run.throwaway?.$disconnect()),
      await attempt("dropping the throwaway database", async () => {
        if (run.isCreated) {
          await dropDatabase(run.admin, run.name);
        }
      }),
      await attempt("checking the throwaway database is gone", () =>
        requireDatabaseGone(run.admin, run.name),
      ),
      await attempt("comparing the configured database", () =>
        requireConfiguredDatabaseUnchanged(run),
      ),
    );
  } finally {
    await run.configured.$disconnect();
    await run.admin.$disconnect();
  }
  const failure = failures.find((candidate) => candidate !== undefined);
  if (failure !== undefined) {
    throw failure;
  }
}

// The cleanup of an interruption by a signal: only what is needed to leave nothing behind, and
// the same name check as the normal teardown (dropDatabase). It never compares the row counts.
async function dropAfterInterruption(run: Run): Promise<void> {
  await Promise.allSettled([run.throwaway?.$disconnect()]);
  if (run.isCreated) {
    await dropDatabase(run.admin, run.name);
  }
  await Promise.allSettled([run.configured.$disconnect(), run.admin.$disconnect()]);
}

async function prepareThrowawayDatabase(run: Run, databaseUrl: string): Promise<SchemaObjects> {
  await requireReachableDatabase(run.admin, databaseUrl);
  await runStep("checking the role", () => requireCreateDatabasePrivilege(run.admin));
  run.rowsBefore = await runStep("counting the rows of the configured database", () =>
    countRows(run.configured),
  );
  if (Object.keys(run.rowsBefore).length === 0) {
    process.stdout.write("The configured database has no tables: nothing to compare afterwards.\n");
  }
  // Set before the statement: if its answer is lost, the cleanup still drops the name (IF EXISTS).
  run.isCreated = true;
  await runStep("creating the throwaway database", () => createDatabase(run.admin, run.name));
  const throwaway = createPrismaClient({
    connectionString: withDatabase(databaseUrl, run.name),
    maxConnections: 1,
  });
  run.throwaway = throwaway;
  await runStep("applying the migrations", () => applyMigrations(throwaway));
  const objects = await runStep("reading the schema", () => readSchemaObjects(throwaway));
  requireEnoughTables(objects);
  return objects;
}

// One throwaway database with a random name per run: the development data is never touched.
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const databaseUrl = requireDatabaseUrl();
  const name = generateThrowawayDatabaseName();
  const run: Run = {
    name,
    admin: createPrismaClient({
      connectionString: withDatabase(databaseUrl, MAINTENANCE_DATABASE),
      maxConnections: 1,
      connectionTimeoutMs: REACHABILITY_TIMEOUT_MS,
    }),
    configured: createPrismaClient({ connectionString: databaseUrl, maxConnections: 1 }),
    throwaway: undefined,
    isCreated: false,
    rowsBefore: undefined,
  };
  const stopListeningToSignals = cleanUpOnSignal(() => dropAfterInterruption(run), run.name);
  try {
    const objects = await prepareThrowawayDatabase(run, databaseUrl);
    process.stdout.write(
      `Throwaway database ready: ${String(objects.tables.length)} tables, ${String(objects.constraints.length)} constraints, ${String(objects.indexes.length)} indexes.\n`,
    );
    project.provide("throwawayDatabase", name);
    project.provide("throwawayConnectionString", withDatabase(databaseUrl, name));
    project.provide("configuredDatabaseUrl", databaseUrl);
    project.provide("schemaObjects", objects);
  } catch (error) {
    // Best effort: when the database is down the cleanup fails too, and it must not hide the
    // clear message of the first failure.
    await finishRun(run, stopListeningToSignals).catch(() => undefined);
    throw error;
  }
  return () => finishRun(run, stopListeningToSignals);
}
