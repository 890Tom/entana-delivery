import { describe, expect, it } from "vitest";
import { expectViolation, SQLSTATE, useRollbackTransaction } from "../support/database.js";
import { constraintCases } from "./check-constraint-cases.js";

describe("CHECK constraints of the migrations", () => {
  const db = useRollbackTransaction();

  it("has a test case for every CHECK constraint of the schema, and none for a missing one", async () => {
    const result = await db().query<{ conname: string }>(
      `SELECT con.conname
         FROM pg_constraint con
         JOIN pg_namespace ns ON ns.oid = con.connamespace
        WHERE con.contype = 'c' AND ns.nspname = $1`,
      // The migrations land in `public` of the throwaway database.
      ["public"],
    );

    const inDatabase = result.rows.map((row) => row.conname).sort();
    const tested = constraintCases.map((testCase) => testCase.constraint).sort();
    expect(tested).toEqual(inDatabase);
  });

  describe.each(constraintCases)("$constraint", ({ constraint, accepted, rejected }) => {
    it.each(accepted)("accepts $name", async ({ run }) => {
      await run(db());
    });

    it.each(rejected)("rejects $name", async ({ run }) => {
      await expectViolation(run(db()), { code: SQLSTATE.checkViolation, constraint });
    });
  });
});
