import { readdirSync, readFileSync } from "node:fs";
import type { PrismaClient } from "@entana/database";
import { SetupError } from "./setup-error.js";

// This suite reads files of another package on purpose: the migrations are immutable and they are
// part of what is tested (the real constraints, with their real names). The apps/api code never
// does this, and the API cannot import pg: the Prisma client of @entana/database runs the SQL.
const MIGRATIONS_DIRECTORY = new URL(
  "../../../../../packages/database/prisma/migrations/",
  import.meta.url,
);

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

export async function applyMigrations(throwaway: PrismaClient): Promise<void> {
  for (const migration of readMigrationsInOrder()) {
    await throwaway.$executeRawUnsafe(migration.sql);
  }
}
