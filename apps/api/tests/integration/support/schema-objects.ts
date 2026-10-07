import type { PrismaClient } from "@entana/database";
import type { SchemaObjects } from "./forbidden-strings.js";
import { SetupError } from "./setup-error.js";

// Fewer tables than this means the migrations did not run as expected: the check would be empty.
const MINIMUM_TABLE_COUNT = 12;

async function readNames(query: Promise<{ name: unknown }[]>): Promise<string[]> {
  const rows = await query;
  return rows.flatMap((row) => (typeof row.name === "string" ? [row.name] : []));
}

// The migrations are not schema-qualified: in a new database they land in `public`.
const PUBLIC_SCHEMA = "public";

// Every name the database could repeat in an error: the leak check is derived from the real schema.
export async function readSchemaObjects(client: PrismaClient): Promise<SchemaObjects> {
  return {
    tables: await readNames(
      client.$queryRaw`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ${PUBLIC_SCHEMA}`,
    ),
    columns: await readNames(
      client.$queryRaw`SELECT DISTINCT column_name AS name FROM information_schema.columns WHERE table_schema = ${PUBLIC_SCHEMA}`,
    ),
    constraints: await readNames(
      client.$queryRaw`SELECT con.conname AS name FROM pg_constraint con JOIN pg_namespace ns ON ns.oid = con.connamespace WHERE ns.nspname = ${PUBLIC_SCHEMA}`,
    ),
    indexes: await readNames(
      client.$queryRaw`SELECT indexname AS name FROM pg_indexes WHERE schemaname = ${PUBLIC_SCHEMA}`,
    ),
  };
}

export function requireEnoughTables(objects: SchemaObjects): void {
  if (objects.tables.length < MINIMUM_TABLE_COUNT) {
    throw new SetupError(
      `Only ${String(objects.tables.length)} tables were found in the throwaway database (at least ${String(MINIMUM_TABLE_COUNT)} expected): the migrations did not run as expected.`,
    );
  }
}
