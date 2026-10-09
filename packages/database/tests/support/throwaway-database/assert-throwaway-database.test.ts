import { describe, expect, it } from "vitest";
import { NotThrowawayDatabaseError, assertThrowawayDatabase } from "./assert-throwaway-database.js";

const RUN_DATABASE = "test_00c0ffee";

// Fakes of the client interface only (the answer of `SELECT current_database()`), not of the database.
function pgClientAnswering(rows: { name: string }[]): {
  query: () => Promise<{ rows: typeof rows }>;
} {
  return { query: () => Promise.resolve({ rows }) };
}

function prismaClientAnswering(rows: { name: string }[]): {
  $queryRaw: () => Promise<typeof rows>;
} {
  return { $queryRaw: () => Promise.resolve(rows) };
}

describe("assertThrowawayDatabase", () => {
  it("accepts the database of the run, through a pg client", async () => {
    await expect(
      assertThrowawayDatabase(pgClientAnswering([{ name: RUN_DATABASE }]), RUN_DATABASE),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["a name that is not a throwaway name", [{ name: "entana" }]],
    [
      "a throwaway-looking name that is not the one of the run (a leftover)",
      [{ name: "test_deadbeef" }],
    ],
    ["no row at all", []],
  ])("refuses %s, through a pg client", async (_label, rows) => {
    await expect(
      assertThrowawayDatabase(pgClientAnswering(rows), RUN_DATABASE),
    ).rejects.toBeInstanceOf(NotThrowawayDatabaseError);
  });

  it("accepts the database of the run, through a Prisma client", async () => {
    await expect(
      assertThrowawayDatabase(prismaClientAnswering([{ name: RUN_DATABASE }]), RUN_DATABASE),
    ).resolves.toBeUndefined();
  });

  it("refuses another database, through a Prisma client", async () => {
    await expect(
      assertThrowawayDatabase(prismaClientAnswering([{ name: "entana" }]), RUN_DATABASE),
    ).rejects.toBeInstanceOf(NotThrowawayDatabaseError);
  });
});
