import type { Client } from "pg";

export type Row = Record<string, unknown>;

export interface SeedContext {
  readonly db: Client;
  readonly now: Date;
  // Today in Indian/Antananarivo, as YYYY-MM-DD.
  readonly today: string;
}

const SQL_IDENTIFIER = /^[a-z][a-z0-9_]*$/;

// Table and column names come from the code of the seed, never from outside. They are put
// between double quotes in the statement, so anything but a plain snake_case name is refused.
export function assertSqlIdentifier(identifier: string): string {
  if (!SQL_IDENTIFIER.test(identifier)) {
    throw new RangeError(`Not a plain SQL identifier: ${JSON.stringify(identifier)}`);
  }
  return identifier;
}

export async function insertRow(db: Client, table: string, values: Row): Promise<Row> {
  assertSqlIdentifier(table);
  const entries = Object.entries(values);
  entries.forEach(([column]) => assertSqlIdentifier(column));
  const columns = entries.map(([column]) => `"${column}"`).join(", ");
  const placeholders = entries.map((_, index) => `$${String(index + 1)}`).join(", ");
  const result = await db.query<Row>(
    `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *`,
    entries.map(([, value]) => value),
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error(`Nothing was inserted into ${table}.`);
  return row;
}

export async function insertRowAndReturnId(
  db: Client,
  table: string,
  values: Row,
): Promise<string> {
  const id = (await insertRow(db, table, values)).id;
  if (typeof id !== "string") throw new Error(`${table} did not return a UUID id.`);
  return id;
}

// An item of a list that must have it: avoids a non-null assertion on indexed access.
export function pick<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`No item at index ${String(index)}.`);
  return item;
}

export function minutesBefore(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * 60_000);
}

export function daysBefore(now: Date, days: number): Date {
  return minutesBefore(now, days * 24 * 60);
}
