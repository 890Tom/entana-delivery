import { describe, expect, it } from "vitest";

import { CLIENT_TS, CLIENT_TSX, PROPERTIES, SYNTAX } from "./support/fixture-rows";
import { isRuleAnError, readRestrictedEntries } from "./support/resolved-rules";
import { ROWS } from "./support/rows";

const CLIENT_PATHS = [CLIENT_TS, CLIENT_TSX, "apps/client/src/fixture.test.tsx"];
// The type-aware @typescript-eslint/no-implied-eval cannot be checked here: the fixtures run
// without type information, so the harness switches it off. Real files are covered by `pnpm lint`.
const ALWAYS_ON_FOR_CLIENT = ["no-eval", "no-implied-eval", "no-new-func"];

function countAlternatives(selector: string | undefined): number {
  return selector === undefined ? 1 : selector.split(", ").length;
}

function rowsCovering(message: string): number {
  return ROWS.filter((row) => row.covers !== undefined && message.startsWith(row.covers)).length;
}

describe.each(CLIENT_PATHS)("the resolved configuration of %s", (filePath) => {
  it.each([SYNTAX, PROPERTIES])(
    "still holds every entry of %s that a fixture exercises",
    async (ruleId) => {
      const messages = (await readRestrictedEntries(filePath, ruleId)).map(
        (entry) => entry.message,
      );

      const expected = ROWS.filter((row) => row.ruleId === ruleId && row.covers !== undefined);
      for (const row of expected) {
        expect(
          messages.some((message) => message.startsWith(row.covers ?? "")),
          `${ruleId} lost "${row.covers ?? ""}": a later block of eslint.config.mjs overrides the rule`,
        ).toBe(true);
      }
    },
  );

  it.each(ALWAYS_ON_FOR_CLIENT)("keeps %s as an error", async (ruleId) => {
    expect(await isRuleAnError(filePath, ruleId)).toBe(true);
  });
});

describe("the React hooks rules", () => {
  it.each(["react-hooks/rules-of-hooks", "react-hooks/exhaustive-deps"])(
    "keep %s as an error for client .tsx files",
    async (ruleId) => {
      expect(await isRuleAnError(CLIENT_TSX, ruleId)).toBe(true);
    },
  );
});

describe("the fixture table", () => {
  it.each([SYNTAX, PROPERTIES])("exercises every configured entry of %s", async (ruleId) => {
    const entries = await readRestrictedEntries(CLIENT_TSX, ruleId);

    for (const entry of entries) {
      const needed = countAlternatives(entry.selector);
      expect(
        rowsCovering(entry.message),
        `"${entry.message}" has ${String(needed)} selector alternative(s) and needs a fixture row for each`,
      ).toBeGreaterThanOrEqual(needed);
    }
  });

  it("has no row left over for an entry that no longer exists", async () => {
    const entries = [
      ...(await readRestrictedEntries(CLIENT_TSX, SYNTAX)),
      ...(await readRestrictedEntries(CLIENT_TSX, PROPERTIES)),
    ];

    for (const row of ROWS.filter((candidate) => candidate.covers !== undefined)) {
      expect(
        entries.some((entry) => entry.message.startsWith(row.covers ?? "")),
        `Row "${row.name}" covers "${row.covers ?? ""}", which is no longer configured`,
      ).toBe(true);
    }
  });

  it("only expects rules that are enabled for the row's own path", async () => {
    for (const row of ROWS) {
      expect(await isRuleAnError(row.filePath, row.ruleId), `${row.name}: ${row.ruleId}`).toBe(
        true,
      );
    }
  });
});
