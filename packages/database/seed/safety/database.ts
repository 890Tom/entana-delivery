import type { Client } from "pg";

// Every table of the data model (docs/data-model.md). _prisma_migrations is not one of them:
// a reset keeps the migration history.
const SEEDED_TABLES = [
  "customer",
  "customer_order",
  "order_item",
  "order_event",
  "product",
  "place",
  "delivery_axis",
  "axis_place",
  "staff_user",
  "audit_log",
  "reseller",
  "shop_setting",
] as const;

const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === UNDEFINED_TABLE;
}

async function tablesWithRows(db: Client): Promise<string[]> {
  const filled: string[] = [];
  try {
    for (const table of SEEDED_TABLES) {
      const result = await db.query<{ filled: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM "${table}") AS filled`,
      );
      if (result.rows[0]?.filled === true) filled.push(table);
    }
  } catch (error) {
    if (isUndefinedTable(error)) {
      throw new Error("The tables do not exist yet. Apply the migrations first.", {
        cause: error,
      });
    }
    throw error;
  }
  return filled;
}

export async function assertDatabaseIsEmpty(db: Client): Promise<void> {
  const filled = await tablesWithRows(db);
  if (filled.length > 0) {
    throw new Error(
      `Refusing to seed: these tables already have rows: ${filled.join(", ")}. ` +
        "To start over on a local throwaway database, use db:reset-and-seed.",
    );
  }
}

// Destructive: only called after the guards of destructive-guard.ts passed.
export async function truncateAllTables(db: Client): Promise<void> {
  const tables = SEEDED_TABLES.map((table) => `"${table}"`).join(", ");
  await db.query(`TRUNCATE TABLE ${tables} CASCADE`);
}
