import { describe, expect, it } from "vitest";

import { lintFixture } from "./support/lint-fixture";
import { CLIENT_TS, CLIENT_TSX, PROPERTIES, SYNTAX } from "./support/fixture-rows";
import { INJECTION_ROWS } from "./support/injection-rows";

const INJECTION_RULES = [SYNTAX, PROPERTIES, "no-eval", "no-new-func"];

const SAFE_FIXTURES = [
  ["rendering {value}", CLIENT_TSX, "export const a = <p>{value}</p>;"],
  ["reading innerHTML", CLIENT_TS, "export function f(el) { return el.innerHTML; }"],
  ["setting textContent", CLIENT_TS, "export function f(el, v) { el.textContent = v; }"],
  ["href={url}", CLIENT_TSX, "export const a = <a href={url}>x</a>;"],
  ["an https literal link", CLIENT_TSX, 'export const a = <a href="https://example.org/a">x</a>;'],
  ["a relative form action", CLIENT_TSX, 'export const a = <form action="/api/v1/orders" />;'],
] as const;

const LONG_FUNCTION = `export function long() {\n${"  call();\n".repeat(45)}}\n`;

describe("safe patterns", () => {
  it.each(SAFE_FIXTURES)("report no injection rule: %s", async (_name, filePath, code) => {
    const { messages } = await lintFixture(code, filePath);

    expect(messages.filter((message) => message.fatal === true)).toEqual([]);
    expect(messages.filter((message) => INJECTION_RULES.includes(message.ruleId ?? ""))).toEqual(
      [],
    );
  });
});

function startsAnInjectionMessage(message: string, covers: string | undefined): boolean {
  return covers !== undefined && message.includes(covers);
}

describe("injection rules by path", () => {
  const testPaths = [
    ["a .test file", "apps/client/src/fixture.test"],
    ["a file in a tests folder", "apps/client/tests/fixture"],
    ["a file in src/test-support", "apps/client/src/test-support/fixture"],
  ] as const;

  describe.each(testPaths)("%s in the client", (_name, stem) => {
    it.each(INJECTION_ROWS.map((row) => [row.name, row] as const))(
      "is NOT exempt: %s",
      async (_rowName, row) => {
        const extension = row.filePath.endsWith("x") ? "tsx" : "ts";

        const { messages } = await lintFixture(row.code, `${stem}.${extension}`);

        expect(
          messages.some(
            (message) =>
              message.ruleId === row.ruleId &&
              startsAnInjectionMessage(message.message, row.covers),
          ),
        ).toBe(true);
      },
    );
  });

  describe.each([["apps/api/src/fixture.ts"], ["packages/contracts/src/fixture.ts"]])(
    "%s",
    (filePath) => {
      it.each(INJECTION_ROWS.map((row) => [row.name, row] as const))(
        "is outside the client override: %s is not reported",
        async (_name, row) => {
          const path = row.filePath.endsWith("x") ? filePath.replace(/ts$/, "tsx") : filePath;

          const { messages } = await lintFixture(row.code, path);

          expect(
            messages.filter((message) => startsAnInjectionMessage(message.message, row.covers)),
          ).toEqual([]);
        },
      );

      it("does not apply the eval rules, but still applies the shared default-export rule", async () => {
        const { messages } = await lintFixture('eval("1"); export default 1;', filePath);

        expect(messages.map((message) => message.ruleId)).not.toContain("no-eval");
        expect(messages.map((message) => message.ruleId)).toContain(SYNTAX);
      });
    },
  );
});

describe("function length by path", () => {
  it.each([
    ["apps/client/src/fixture.test.tsx", false],
    ["apps/client/tests/fixture.tsx", false],
    ["apps/client/src/fixture.tsx", true],
    ["apps/client/src/fixture.ts", true],
  ] as const)("%s reports max-lines-per-function: %s", async (filePath, isReported) => {
    const { messages } = await lintFixture(LONG_FUNCTION, filePath);

    expect(messages.some((message) => message.ruleId === "max-lines-per-function")).toBe(
      isReported,
    );
  });
});
