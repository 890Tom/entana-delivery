import { Client, DatabaseError } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, expect, inject } from "vitest";
import { assertThrowawayDatabase } from "../throwaway-database/assert-throwaway-database.js";

// Every test runs in a transaction that is rolled back: tests never see each other's rows. The
// connection is to the throwaway database of the run, never to the configured one.
export function useRollbackTransaction(): () => Client {
  let client: Client | undefined;

  beforeAll(async () => {
    client = new Client({ connectionString: inject("throwawayConnectionString") });
    await client.connect();
  });
  beforeEach(async () => {
    if (client !== undefined) await assertThrowawayDatabase(client);
    await client?.query("BEGIN");
  });
  afterEach(async () => {
    await client?.query("ROLLBACK");
  });
  afterAll(async () => {
    await client?.end();
  });

  return () => {
    if (client === undefined) throw new Error("The database connection is not open yet.");
    return client;
  };
}

export const SQLSTATE = {
  // ON DELETE RESTRICT raises 23001. 23503 is what ON DELETE NO ACTION (the default) raises.
  restrictViolation: "23001",
  uniqueViolation: "23505",
  checkViolation: "23514",
} as const;

export async function expectViolation(
  statement: Promise<unknown>,
  expected: { code: string; constraint: string },
): Promise<void> {
  const error = await statement.then(
    () => undefined,
    (rejection: unknown) => rejection,
  );
  expect(error, "the statement should have been rejected by the database").toBeInstanceOf(
    DatabaseError,
  );
  expect(error).toMatchObject(expected);
}
