import { Client, DatabaseError } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, expect, inject } from "vitest";
import { requireDatabaseUrl } from "./database-url.js";

// Every test runs in a transaction that is rolled back: tests never see each other's rows.
export function useRollbackTransaction(): () => Client {
  let client: Client | undefined;

  beforeAll(async () => {
    client = new Client({
      connectionString: requireDatabaseUrl(),
      options: `-c search_path=${inject("temporarySchema")}`,
    });
    await client.connect();
  });
  beforeEach(async () => {
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
