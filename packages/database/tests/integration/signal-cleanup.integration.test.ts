import { constants } from "node:os";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { assertThrowawayDatabase } from "../support/throwaway-database/assert-throwaway-database.js";
import { runSuiteInterruptedBy } from "../support/interrupt/run-interrupted-suite.js";
import { isThrowawayDatabaseName } from "../support/throwaway-database/throwaway-database.js";

const TEST_TIMEOUT_MS = 120_000;

describe("the integration suite interrupted by a signal", () => {
  let reader: Client;

  beforeAll(async () => {
    // Reads pg_database, which lists the databases of the whole server.
    reader = new Client({ connectionString: inject("throwawayConnectionString") });
    await reader.connect();
  });

  afterAll(async () => {
    await reader.end();
  });

  async function isDatabasePresent(database: string): Promise<boolean> {
    const result = await reader.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    return result.rowCount !== 0;
  }

  // Only when the assertions failed: the child run created this database, and a failing test must
  // not leave it on the server. The name is the one the child reported, and it is checked again.
  async function dropLeftover(database: string): Promise<void> {
    if (isThrowawayDatabaseName(database) && (await isDatabasePresent(database))) {
      await assertThrowawayDatabase(reader);
      await reader.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
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
