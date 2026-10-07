import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  NotThrowawayDatabaseError,
  assertThrowawayDatabase,
} from "../support/assert-throwaway-database.js";
import { countRows, findChangedTables } from "../support/count-rows.js";
import { isThrowawayDatabaseName } from "../support/throwaway-database.js";

describe("the throwaway database of the run", () => {
  let throwaway: Client;
  // Only `SELECT current_database()` ever runs on this client: it is the configured database.
  let configured: Client;

  beforeAll(async () => {
    throwaway = new Client({ connectionString: inject("throwawayConnectionString") });
    configured = new Client({ connectionString: inject("configuredDatabaseUrl") });
    await throwaway.connect();
    await configured.connect();
  });

  afterAll(async () => {
    await throwaway.end();
    await configured.end();
  });

  it("is named test_ and lowercase hex", () => {
    expect(isThrowawayDatabaseName(inject("throwawayDatabase"))).toBe(true);
  });

  it("is accepted by assertThrowawayDatabase", async () => {
    await expect(assertThrowawayDatabase(throwaway)).resolves.toBeUndefined();
  });

  it("refuses the configured database, with a fixed message", async () => {
    const failure: unknown = await assertThrowawayDatabase(configured).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(NotThrowawayDatabaseError);
    expect(failure).toHaveProperty(
      "message",
      "Refusing a destructive statement: the connected database is not the throwaway test one.",
    );
  });

  it("lists the tables of the migrated database", async () => {
    const counts = await countRows(throwaway);

    expect(Object.keys(counts)).toEqual(expect.arrayContaining(["customer", "product"]));
  });

  it("sees one inserted row in the counts", async () => {
    await assertThrowawayDatabase(throwaway);
    const before = await countRows(throwaway);
    await throwaway.query("BEGIN");
    try {
      await throwaway.query("INSERT INTO customer (phone_e164) VALUES ('+261330000001')");

      const after = await countRows(throwaway);

      expect(findChangedTables(before, after)).toEqual(["customer"]);
    } finally {
      await throwaway.query("ROLLBACK");
    }
  });
});
