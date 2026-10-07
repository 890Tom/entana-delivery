import type { PrismaClient } from "@entana/database";
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

/**
 * Call it before every destructive statement a test of this suite runs (deleteMany, delete,
 * TRUNCATE, raw DELETE or DROP). It asks the server which database the client is really connected
 * to, and only the database created by the global setup for this run passes: a name that merely
 * looks like one (a leftover of a killed run, say) is refused.
 */
export async function assertThrowawayDatabase(
  client: Pick<PrismaClient, "$queryRaw">,
): Promise<void> {
  const rows = await client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  const name = rows[0]?.name;
  if (
    name === undefined ||
    !isThrowawayDatabaseName(name) ||
    name !== inject("throwawayDatabase")
  ) {
    throw new NotThrowawayDatabaseError();
  }
}
