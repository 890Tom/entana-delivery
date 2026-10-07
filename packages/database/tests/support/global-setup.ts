import { readdirSync, readFileSync } from "node:fs";
import { Client } from "pg";
import type { TestProject } from "vitest/node";
import { countRows, findChangedTables } from "./count-rows.js";
import type { RowCounts } from "./count-rows.js";
import { cleanUpOnSignal } from "./interrupt-cleanup.js";
import { describeDatabaseTarget, requireDatabaseUrl } from "./database-url.js";
import { checkTestDatabaseHost, isRemoteOverrideEnabled } from "./test-database-guard.js";
import { generateThrowawayDatabaseName, isThrowawayDatabaseName } from "./throwaway-database.js";

declare module "vitest" {
  export interface ProvidedContext {
    /** Name of the database created for this run: `test_` and lowercase hex. */
    throwawayDatabase: string;
    /** Points at the throwaway database. Holds the password. */
    throwawayConnectionString: string;
    /** The configured database, for read-only checks that it is refused. Holds the password. */
    configuredDatabaseUrl: string;
  }
}

const migrationsDirectory = new URL("../../prisma/migrations/", import.meta.url);
const REMOTE_DATABASE_OVERRIDE = "ENTANA_ALLOW_REMOTE_TEST_DB";
// Always present on a PostgreSQL server: the connection that creates and drops the throwaway one.
const MAINTENANCE_DATABASE = "postgres";

/** A failure whose text is ours: the only kind of error the setup lets through as it is. */
class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupError";
  }
}

// Mutable on purpose: it records how far the setup got, so that the cleanup does only what is needed.
interface Run {
  readonly name: string;
  /** Connected to the maintenance database: creates and drops the throwaway one. */
  readonly admin: Client;
  /** Connected to the configured database, for read-only row counts only. */
  readonly configured: Client;
  throwaway: Client | undefined;
  isCreated: boolean;
  rowsBefore: RowCounts | undefined;
}

function readMigrationsInOrder(): { name: string; sql: string }[] {
  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(new URL(`${name}/migration.sql`, migrationsDirectory), "utf8"),
    }));
}

// The URL of another database of the same server, derived without printing any part of the original.
function withDatabase(databaseUrl: string, database: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function connect(databaseUrl: string): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
  } catch {
    // Never skip silently, in CI as well as locally: a skipped database test proves nothing.
    // The original error is dropped on purpose: it can quote the connection string.
    throw new SetupError(
      `PostgreSQL is not reachable at ${describeDatabaseTarget(databaseUrl)}. Start it with \`pnpm db:up\`.`,
    );
  }
  return client;
}

// Runs before the first connection and DNS lookup. The texts are fixed: the connection string
// holds the password and the host, and none of it is printed.
function requireLocalDatabase(databaseUrl: string): void {
  if (checkTestDatabaseHost(databaseUrl) === "allowed") return;
  if (!isRemoteOverrideEnabled(process.env[REMOTE_DATABASE_OVERRIDE])) {
    throw new SetupError(
      `Refusing to run: DATABASE_URL does not point to this machine (localhost, 127.0.0.0/8 or [::1]). This suite creates and drops a database. Set ${REMOTE_DATABASE_OVERRIDE}=1 only for a database that is meant for tests.`,
    );
  }
  process.stderr.write(
    `Warning: ${REMOTE_DATABASE_OVERRIDE}=1, a database will be created and dropped on the configured server.\n`,
  );
}

// The role must be allowed to create the throwaway database: fail early with a clear message.
async function requireCreateDatabasePrivilege(admin: Client): Promise<void> {
  const result = await admin.query<{ allowed: boolean }>(
    "SELECT (rolcreatedb OR rolsuper) AS allowed FROM pg_roles WHERE rolname = current_user",
  );
  if (result.rows[0]?.allowed !== true) {
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

async function createDatabase(admin: Client, name: string): Promise<void> {
  requireThrowawayName(name);
  await admin.query(`CREATE DATABASE "${name}"`);
}

async function dropDatabase(admin: Client, name: string): Promise<void> {
  requireThrowawayName(name);
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [name],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
}

async function requireDatabaseGone(admin: Client, name: string): Promise<void> {
  const result = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (result.rowCount !== 0) {
    throw new SetupError("The throwaway database still exists after the teardown.");
  }
}

async function requireConfiguredDatabaseUnchanged(run: Run): Promise<void> {
  if (run.rowsBefore === undefined) return;
  const changed = findChangedTables(run.rowsBefore, await countRows(run.configured));
  if (changed.length > 0) {
    throw new SetupError(
      `The row counts of the configured database changed (tables: ${changed.join(", ")}). Either a test did not use the throwaway database, or something else wrote to the configured database during the run (a running development server, for example).`,
    );
  }
}

// A step that fails for a reason of its own (a driver error can quote the connection string or
// the SQL) is reported by name only.
async function attempt(step: string, action: () => Promise<void>): Promise<SetupError | undefined> {
  try {
    await action();
    return undefined;
  } catch (error) {
    return error instanceof SetupError
      ? error
      : new SetupError(`The test teardown failed: ${step}.`);
  }
}

// Also the cleanup of a failed setup. Every step runs whatever the previous one did, so that one
// failure never hides another, and every client is closed so that the process can exit.
async function finishRun(run: Run, stopListeningToSignals: () => void): Promise<void> {
  stopListeningToSignals();
  const failures: (SetupError | undefined)[] = [];
  try {
    failures.push(
      await attempt("closing the throwaway client", async () => run.throwaway?.end()),
      await attempt("dropping the throwaway database", async () => {
        if (run.isCreated) await dropDatabase(run.admin, run.name);
      }),
      await attempt("checking the throwaway database is gone", () =>
        requireDatabaseGone(run.admin, run.name),
      ),
      await attempt("comparing the configured database", () =>
        requireConfiguredDatabaseUnchanged(run),
      ),
    );
  } finally {
    await run.configured.end().catch(() => undefined);
    await run.admin.end().catch(() => undefined);
  }
  const failure = failures.find((candidate) => candidate !== undefined);
  if (failure !== undefined) throw failure;
}

// The cleanup of an interruption by a signal: only what is needed to leave nothing behind, and
// the same name check as the normal teardown (dropDatabase). It never compares the row counts.
async function dropAfterInterruption(run: Run): Promise<void> {
  await Promise.allSettled([run.throwaway?.end()]);
  if (run.isCreated) {
    await dropDatabase(run.admin, run.name);
  }
  await Promise.allSettled([run.configured.end(), run.admin.end()]);
}

async function prepareThrowawayDatabase(run: Run, databaseUrl: string): Promise<string> {
  await requireCreateDatabasePrivilege(run.admin);
  run.rowsBefore = await countRows(run.configured);
  if (Object.keys(run.rowsBefore).length === 0) {
    process.stdout.write("The configured database has no tables: nothing to compare afterwards.\n");
  }
  // Set before the statement: if its answer is lost, the cleanup still drops the name (IF EXISTS).
  run.isCreated = true;
  await createDatabase(run.admin, run.name);
  const throwawayUrl = withDatabase(databaseUrl, run.name);
  run.throwaway = await connect(throwawayUrl);
  for (const migration of readMigrationsInOrder()) {
    await run.throwaway.query(migration.sql);
  }
  return throwawayUrl;
}

// With the remote override on, an unparseable URL gets past the guard: parsing it later would
// throw an error that carries the whole input, password included.
function requireParseableUrl(databaseUrl: string): void {
  try {
    new URL(databaseUrl);
  } catch {
    throw new SetupError("DATABASE_URL is not a valid URL.");
  }
}

// If the second connection fails, the first one is closed: nothing else would close it.
async function openRun(databaseUrl: string, name: string): Promise<Run> {
  const admin = await connect(withDatabase(databaseUrl, MAINTENANCE_DATABASE));
  try {
    const configured = await connect(databaseUrl);
    return {
      name,
      admin,
      configured,
      throwaway: undefined,
      isCreated: false,
      rowsBefore: undefined,
    };
  } catch (error) {
    await admin.end().catch(() => undefined);
    throw error;
  }
}

// One throwaway database with a random name per run: the development data is never touched.
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const databaseUrl = requireDatabaseUrl();
  requireLocalDatabase(databaseUrl);
  requireParseableUrl(databaseUrl);
  const name = generateThrowawayDatabaseName();
  const run = await openRun(databaseUrl, name);
  const stopListeningToSignals = cleanUpOnSignal(() => dropAfterInterruption(run), run.name);
  try {
    const throwawayUrl = await prepareThrowawayDatabase(run, databaseUrl);
    project.provide("throwawayDatabase", name);
    project.provide("throwawayConnectionString", throwawayUrl);
    project.provide("configuredDatabaseUrl", databaseUrl);
  } catch (error) {
    // Best effort: it must not hide the clear message of the first failure.
    await finishRun(run, stopListeningToSignals).catch(() => undefined);
    throw error instanceof SetupError ? error : new SetupError("The test setup failed.");
  }
  return () => finishRun(run, stopListeningToSignals);
}
