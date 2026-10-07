import type { PrismaClient } from "@entana/database";

export type RowCounts = Readonly<Record<string, number>>;

/** Read-only: one SELECT count(*) per table of the public schema of the client's database. */
export async function countRows(client: PrismaClient): Promise<RowCounts> {
  const tables = await client.$queryRaw<{ name: string }[]>`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
  const counts: Record<string, number> = {};
  for (const { name } of tables) {
    // The name comes from the catalogue of the server, and is quoted as an identifier anyway.
    const quoted = `"${name.replaceAll('"', '""')}"`;
    const rows = await client.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM public.${quoted}`,
    );
    counts[name] = rows[0]?.n ?? 0;
  }
  return counts;
}

/** The tables whose row count differs, or that appeared or disappeared. Names only. */
export function findChangedTables(before: RowCounts, after: RowCounts): string[] {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].filter((name) => before[name] !== after[name]).sort();
}
