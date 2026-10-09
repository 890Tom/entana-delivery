import { inject } from "vitest";
import { isThrowawayDatabaseName } from "./throwaway-database.js";

/** The message is fixed: it quotes neither the database name nor any part of a URL. */
export class NotThrowawayDatabaseError extends Error {
  constructor() {
    super(
      "Refusing a destructive statement: the connected database is not the throwaway test one.",
    );
    this.name = "NotThrowawayDatabaseError";
  }
}

// Only what the guard needs: the `pg` Client and the PrismaClient both fit.
interface PgClient {
  query(sql: string): Promise<{ rows: { name: string }[] }>;
}
interface PrismaClientLike {
  $queryRaw(query: TemplateStringsArray): Promise<{ name: string }[]>;
}
type DatabaseClient = PgClient | PrismaClientLike;

async function readDatabaseName(client: DatabaseClient): Promise<string | undefined> {
  if ("$queryRaw" in client) {
    const rows = await client.$queryRaw`SELECT current_database() AS name`;
    return rows[0]?.name;
  }
  const result = await client.query("SELECT current_database() AS name");
  return result.rows[0]?.name;
}

/**
 * Call it before every destructive statement a test of this suite runs (DELETE, TRUNCATE, DROP,
 * deleteMany). It asks the server which database the client is really connected to, and only the
 * database created by the global setup for this run passes: a name that merely looks like one (a
 * leftover of a killed run, say) is refused.
 */
export async function assertThrowawayDatabase(
  client: DatabaseClient,
  expectedName: string = inject("throwawayDatabase"),
): Promise<void> {
  const name = await readDatabaseName(client);
  if (name === undefined || !isThrowawayDatabaseName(name) || name !== expectedName) {
    throw new NotThrowawayDatabaseError();
  }
}
