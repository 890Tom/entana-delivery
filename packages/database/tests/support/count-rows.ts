import type { Client } from "pg";

export type RowCounts = Readonly<Record<string, number>>;

/**
 * Read-only. An exact count is needed because the check proves that nothing was written; an
 * estimate from the statistics could not.
 */
export async function countRows(client: Pick<Client, "query">): Promise<RowCounts> {
  const tables = await client.query<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  const counts: Record<string, number> = {};
  for (const { name } of tables.rows) {
    // Table names cannot be bound as parameters: the name comes from the catalogue of the server
    // and is quoted as an identifier.
    const quoted = `"${name.replaceAll('"', '""')}"`;
    const result = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.${quoted}`,
    );
    counts[name] = result.rows[0]?.n ?? 0;
  }
  return counts;
}

/** The tables whose row count differs, or that appeared or disappeared. Names only. */
export function findChangedTables(before: RowCounts, after: RowCounts): string[] {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].filter((name) => before[name] !== after[name]).sort();
}
