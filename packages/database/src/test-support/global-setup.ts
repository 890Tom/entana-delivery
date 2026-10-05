import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { Client } from "pg";
import type { TestProject } from "vitest/node";
import { describeDatabaseTarget, requireDatabaseUrl } from "./database-url.js";

declare module "vitest" {
  export interface ProvidedContext {
    temporarySchema: string;
  }
}

const migrationsDirectory = new URL("../../prisma/migrations/", import.meta.url);

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

async function connect(databaseUrl: string): Promise<Client> {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
  } catch (error) {
    // Never skip silently, in CI as well as locally: a skipped database test proves nothing.
    throw new Error(
      `PostgreSQL is not reachable at ${describeDatabaseTarget(databaseUrl)}. Start it with \`pnpm db:up\`.`,
      { cause: error },
    );
  }
  return client;
}

async function dropSchema(databaseUrl: string, schema: string): Promise<void> {
  const client = await connect(databaseUrl);
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await client.end();
  }
}

async function createSchemaWithMigrations(databaseUrl: string, schema: string): Promise<void> {
  const client = await connect(databaseUrl);
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    // Prisma's SQL is not schema-qualified: it lands in the first schema of the search path.
    await client.query(`SET search_path TO "${schema}"`);
    for (const migration of readMigrationsInOrder()) {
      await client.query(migration.sql);
    }
  } finally {
    await client.end();
  }
}

// One throwaway schema with a random name per run: the development data is never touched.
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const databaseUrl = requireDatabaseUrl();
  const schema = `test_${randomBytes(6).toString("hex")}`;
  try {
    await createSchemaWithMigrations(databaseUrl, schema);
  } catch (error) {
    await dropSchema(databaseUrl, schema);
    throw error;
  }
  project.provide("temporarySchema", schema);
  return () => dropSchema(databaseUrl, schema);
}
