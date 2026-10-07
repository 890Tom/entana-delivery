import { constants } from "node:os";
import { createPrismaClient } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { assertThrowawayDatabase } from "./support/assert-throwaway-database.js";
import { runSuiteInterruptedBy } from "./support/run-interrupted-suite.js";
import { isThrowawayDatabaseName } from "./support/throwaway-database.js";

const TEST_TIMEOUT_MS = 120_000;

describe("the integration suite interrupted by a signal", () => {
  let reader: PrismaClient;

  beforeAll(() => {
    // Reads pg_database, which lists the databases of the whole server.
    reader = createPrismaClient({
      connectionString: inject("throwawayConnectionString"),
      maxConnections: 1,
    });
  });

  afterAll(async () => {
    await reader.$disconnect();
  });

  async function isDatabasePresent(database: string): Promise<boolean> {
    const rows = await reader.$queryRaw<
      { found: number }[]
    >`SELECT 1 AS found FROM pg_database WHERE datname = ${database}`;
    return rows.length > 0;
  }

  // Only when the assertions failed: the child run created this database, and a failing test must
  // not leave it on the server. The name is the one the child reported, and it is checked again.
  async function dropLeftover(database: string): Promise<void> {
    if (isThrowawayDatabaseName(database) && (await isDatabasePresent(database))) {
      await assertThrowawayDatabase(reader);
      await reader.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    }
  }

  it.each(["SIGTERM", "SIGINT"] as const)(
    "drops its throwaway database and exits with the code of %s",
    async (signal) => {
      let reported: string | undefined;

      try {
        const run = await runSuiteInterruptedBy(signal, async (database) => {
          reported = database;
          expect(await isDatabasePresent(database)).toBe(true);
        });

        expect(run.exitCode).toBe(128 + constants.signals[signal]);
        expect(await isDatabasePresent(run.database)).toBe(false);
      } finally {
        if (reported !== undefined) {
          await dropLeftover(reported);
        }
      }
    },
    TEST_TIMEOUT_MS,
  );
});
