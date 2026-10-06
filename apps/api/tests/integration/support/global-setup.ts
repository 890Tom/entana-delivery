import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createPrismaClient } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import type { TestProject } from "vitest/node";
import type { SchemaObjects } from "./forbidden-strings.js";

declare module "vitest" {
  export interface ProvidedContext {
    temporarySchema: string;
    /** Points at the temporary schema through the `options` parameter. Holds the password. */
    schemaConnectionString: string;
    schemaObjects: SchemaObjects;
  }
}

// This suite reads files of another package on purpose: the migrations are immutable and they are
// part of what is tested (the real constraints, with their real names). The apps/api code never
// does this, and the API cannot import pg: the Prisma client of @entana/database runs the SQL.
const MIGRATIONS_DIRECTORY = new URL(
  "../../../../../packages/database/prisma/migrations/",
  import.meta.url,
);

/** A failure whose text is ours: the only kind of error the setup lets through as it is. */
class SetupError extends Error {}

// This suite creates and drops a schema, and runs the migrations: it must never reach a database
// that is not the developer's own by accident (a production URL left in the shell or in .env).
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);
const REMOTE_DATABASE_OVERRIDE = "ENTANA_ALLOW_REMOTE_TEST_DB";

// Fewer tables than this means the migrations did not run as expected: the check would be empty.
const MINIMUM_TABLE_COUNT = 12;
const REACHABILITY_TIMEOUT_MS = 3000;

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
  let hostname: string;
  try {
    ({ hostname } = new URL(databaseUrl));
  } catch {
    // The parse error is dropped on purpose: it carries the input.
    throw new SetupError("DATABASE_URL is not a valid URL.");
  }
  if (!LOOPBACK_HOSTS.has(hostname) && process.env[REMOTE_DATABASE_OVERRIDE] !== "1") {
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

function withSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-c search_path=${schema}`);
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

function readMigrationsInOrder(): { name: string; sql: string }[] {
  let names: string[];
  try {
    names = readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    throw new SetupError(`The migrations folder cannot be read: ${MIGRATIONS_DIRECTORY.pathname}`);
  }
  if (names.length === 0) {
    throw new SetupError(`The migrations folder is empty: ${MIGRATIONS_DIRECTORY.pathname}`);
  }
  return names.map((name) => ({
    name,
    sql: readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS_DIRECTORY), "utf8"),
  }));
}

// Prisma's SQL is not schema-qualified: it lands in the first schema of the search path.
async function applyMigrations(schemaClient: PrismaClient): Promise<void> {
  for (const migration of readMigrationsInOrder()) {
    await schemaClient.$executeRawUnsafe(migration.sql);
  }
}

async function readNames(query: Promise<{ name: unknown }[]>): Promise<string[]> {
  const rows = await query;
  return rows.flatMap((row) => (typeof row.name === "string" ? [row.name] : []));
}

// Every name the database could repeat in an error: the leak check is derived from the real schema.
async function readSchemaObjects(client: PrismaClient, schema: string): Promise<SchemaObjects> {
  return {
    tables: await readNames(
      client.$queryRaw`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ${schema}`,
    ),
    columns: await readNames(
      client.$queryRaw`SELECT DISTINCT column_name AS name FROM information_schema.columns WHERE table_schema = ${schema}`,
    ),
    constraints: await readNames(
      client.$queryRaw`SELECT con.conname AS name FROM pg_constraint con JOIN pg_namespace ns ON ns.oid = con.connamespace WHERE ns.nspname = ${schema}`,
    ),
    indexes: await readNames(
      client.$queryRaw`SELECT indexname AS name FROM pg_indexes WHERE schemaname = ${schema}`,
    ),
  };
}

function requireEnoughTables(objects: SchemaObjects): void {
  if (objects.tables.length < MINIMUM_TABLE_COUNT) {
    throw new SetupError(
      `Only ${String(objects.tables.length)} tables were found in the temporary schema (at least ${String(MINIMUM_TABLE_COUNT)} expected): the migrations did not run as expected.`,
    );
  }
}

async function cleanUp(
  admin: PrismaClient,
  schemaClient: PrismaClient | undefined,
  schemaToDrop: string | undefined,
): Promise<void> {
  // The pools are closed so that the process can exit.
  await schemaClient?.$disconnect();
  if (schemaToDrop !== undefined) {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaToDrop}" CASCADE`);
  }
  await admin.$disconnect();
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

// One throwaway schema with a random name per run: the development data is never touched.
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const databaseUrl = requireDatabaseUrl();
  const schema = `test_${randomBytes(6).toString("hex")}`;
  const schemaConnectionString = withSearchPath(databaseUrl, schema);
  const admin = createPrismaClient({
    connectionString: databaseUrl,
    maxConnections: 1,
    connectionTimeoutMs: REACHABILITY_TIMEOUT_MS,
  });
  let schemaClient: PrismaClient | undefined;
  let isSchemaCreated = false;
  try {
    await requireReachableDatabase(admin, databaseUrl);
    await runStep("creating the schema", () =>
      admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`),
    );
    isSchemaCreated = true;
    schemaClient = createPrismaClient({
      connectionString: schemaConnectionString,
      maxConnections: 1,
    });
    const client = schemaClient;
    await runStep("applying the migrations", () => applyMigrations(client));
    const schemaObjects = await runStep("reading the schema", () =>
      readSchemaObjects(client, schema),
    );
    requireEnoughTables(schemaObjects);
    process.stdout.write(
      `Temporary schema ready: ${String(schemaObjects.tables.length)} tables, ${String(schemaObjects.constraints.length)} constraints, ${String(schemaObjects.indexes.length)} indexes.\n`,
    );
    project.provide("temporarySchema", schema);
    project.provide("schemaConnectionString", schemaConnectionString);
    project.provide("schemaObjects", schemaObjects);
  } catch (error) {
    // Best effort, and only for a schema this run created: a failed CREATE SCHEMA must never lead
    // to dropping one that belongs to someone else. When the database is down the cleanup fails
    // too, and it must not hide the clear message of the first failure.
    await cleanUp(admin, schemaClient, isSchemaCreated ? schema : undefined).catch(() => undefined);
    throw error;
  }
  return () => cleanUp(admin, schemaClient, schema);
}
