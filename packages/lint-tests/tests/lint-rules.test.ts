import { describe, expect, it } from "vitest";

import { lintFixture } from "./support/lint-fixture";
import { ROWS } from "./support/rows";

function positionOf(code: string, text: string): { line: number; column: number } {
  const index = code.indexOf(text);
  if (index < 0) {
    throw new Error(`Fixture bug: "${text}" is not in the code`);
  }
  const before = code.slice(0, index).split("\n");
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
}

describe("lint rule fixtures", () => {
  it("has fixtures", () => {
    expect(ROWS.length).toBeGreaterThan(0);
  });

  it.each(ROWS.map((row) => [row.name, row] as const))("reports %s", async (_name, row) => {
    const { messages } = await lintFixture(row.code, row.filePath);

    expect(messages.filter((message) => message.fatal === true)).toEqual([]);
    const reported = messages.filter((message) => message.ruleId === row.ruleId);
    expect(
      reported.map((message) => ({ line: message.line, column: message.column })),
    ).toContainEqual(positionOf(row.code, row.at));
    expect(reported.map((message) => message.message).join("\n")).toContain(row.messageFragment);
  });
});
