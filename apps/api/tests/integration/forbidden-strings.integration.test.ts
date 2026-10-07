import { describe, expect, inject, it, vi } from "vitest";
import { startConsoleCapture } from "./support/console-capture.js";
import {
  NO_EXEMPTIONS,
  buildForbiddenStrings,
  countForbiddenStrings,
  findLeak,
  findNamesIgnoredAsKeys,
} from "./support/forbidden-strings.js";
import type { Exemptions, ForbiddenStrings, OutputName } from "./support/forbidden-strings.js";
import { ERROR_LEVEL, INFO_LEVEL, partOfLine, schemaWords } from "./support/output-parts.js";

const VALUE_LABEL = "an inserted or used value";
const MINIMUM_NAME_LENGTH = 6;

describe("the matcher of forbidden strings", () => {
  const { table, column, constraint } = schemaWords();
  const objects = inject("schemaObjects");
  const index = objects.indexes.find((name) => name.length >= MINIMUM_NAME_LENGTH) ?? "";
  const shortName = [...objects.tables, ...objects.columns].find(
    (name) => name.length < MINIMUM_NAME_LENGTH,
  );
  const databaseName = inject("throwawayDatabase");
  const usedValue = "stored-value-0a1b2c3d";
  const uuid = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
  const password = "hunter2:pass@word";
  const encodedPassword = encodeURIComponent(password);
  const connectionString = `postgresql://shop:${encodedPassword}@db.internal:5432/entana?options=x`;
  const forbidden: ForbiddenStrings = buildForbiddenStrings({
    databaseName,
    schemaObjects: objects,
    usedValues: [usedValue, uuid],
    password,
    connectionString,
  });
  // Every broad name exempt in every output: the raw scan must not care.
  const everythingExempt: Exemptions = {
    headers: forbidden.valueScan,
    body: forbidden.valueScan,
    "access log": forbidden.valueScan,
    "failure log": forbidden.valueScan,
    console: forbidden.valueScan,
  };

  it("has real names to look for (it is derived from the schema, never empty)", () => {
    expect([table, column, constraint, index]).not.toContain("");
    expect(countForbiddenStrings(forbidden)).toBeGreaterThan(objects.constraints.length);
  });

  it("flags a log line that holds a table name in a value", () => {
    const line = { level: ERROR_LEVEL, msg: `relation "${table}" is broken` };

    expect(findLeak(forbidden, partOfLine("failure log", line))).toBe(table.toLowerCase());
  });

  it("ignores the same word when it is only a key", () => {
    const line = { level: INFO_LEVEL, [table]: "fine" };
    const output = partOfLine("failure log", line);

    expect(findLeak(forbidden, output)).toBeUndefined();
    expect(findNamesIgnoredAsKeys(forbidden, output)).toContain(table.toLowerCase());
  });

  it("ignores a name that is shorter than the floor: it is an ordinary word", () => {
    expect(shortName).toBeDefined();

    expect(findLeak(forbidden, partOfLine("failure log", { msg: shortName }))).toBeUndefined();
  });

  it.each<OutputName>(["body", "access log", "failure log", "console"])(
    "flags a name that is exempt in headers when it shows up in %s",
    (output) => {
      const exemptions: Exemptions = { ...NO_EXEMPTIONS, headers: [column] };
      const line = { value: column };

      expect(findLeak(forbidden, partOfLine("headers", line), exemptions)).toBeUndefined();
      expect(findLeak(forbidden, partOfLine(output, line), exemptions)).toBe(column.toLowerCase());
    },
  );

  it("flags a name that is exempt in the failure log when it shows up in the console", () => {
    const exemptions: Exemptions = { ...NO_EXEMPTIONS, "failure log": [column] };
    const line = { value: column };

    expect(findLeak(forbidden, partOfLine("failure log", line), exemptions)).toBeUndefined();
    expect(findLeak(forbidden, partOfLine("console", line), exemptions)).toBe(column.toLowerCase());
  });

  it.each([
    ["a constraint name, even as a key", { [constraint]: 1 }, constraint.toLowerCase()],
    ["an index name", { msg: `index ${index}` }, index.toLowerCase()],
    ["a value that was inserted", { msg: `saved ${usedValue}` }, VALUE_LABEL],
    ["a UUID that was used", { msg: uuid.toUpperCase() }, VALUE_LABEL],
    ["the database name", { msg: `in ${databaseName}` }, "the database name"],
    ["the password", { msg: `password ${password}` }, "the password"],
    ["the password as written in a URL", { msg: `x ${encodedPassword}` }, "the password"],
    ["the word violates", { msg: "it Violates a rule" }, "violates"],
    ["the words duplicate key", { msg: "Duplicate Key value" }, "duplicate key"],
    ["the word constraint", { msg: "a Constraint failed" }, "constraint"],
    ["the word SQLSTATE", { msg: "SQLSTATE 00000" }, "sqlstate"],
    ["a driver code", { msg: "failed with P2002" }, "p2002"],
    ["a SQLSTATE", { msg: "code 23505" }, "23505"],
  ])("still flags %s, whatever is exempt", (_description, line, expected) => {
    const output = partOfLine("failure log", line);

    expect(findLeak(forbidden, output, everythingExempt)).toBe(expected);
  });

  it.each<OutputName>(["headers", "body", "access log", "failure log", "console"])(
    "flags a high-signal string in %s",
    (output) => {
      const leak = findLeak(forbidden, partOfLine(output, { msg: `saved ${usedValue}` }));

      expect(leak).toBe(VALUE_LABEL);
    },
  );

  it("flags the connection string when the password is not what it holds", () => {
    const withoutPassword = buildForbiddenStrings({
      databaseName,
      schemaObjects: objects,
      usedValues: [],
      password: "",
      connectionString,
    });
    const output = partOfLine("console", { msg: connectionString });

    // The broad words ("postgres") are exempted: this is about the raw scan.
    expect(findLeak(withoutPassword, output, everythingExempt)).toBe("the connection string");
  });

  it("never returns the secret itself, only its label", () => {
    const leaks = [usedValue, password, encodedPassword, connectionString, databaseName].map(
      (text) => findLeak(forbidden, partOfLine("failure log", { msg: text })),
    );

    expect(leaks.join("|")).not.toMatch(/hunter2|0a1b2c3d|postgresql:|test_/);
  });

  it.each([
    ["a longer run of digits before", { responseTime: 1235052 }],
    ["a letter after", { msg: "P2002x" }],
    ["a letter before", { msg: "xP2002" }],
  ])("does not take a code for a leak inside %s", (_description, line) => {
    expect(findLeak(forbidden, partOfLine("access log", line))).toBeUndefined();
  });
});

describe("the capture of the console", () => {
  it("records a console call, a direct write to stdout and one to stderr", () => {
    const capture = startConsoleCapture();
    // Calls through Reflect: this test must not use the console, it proves the capture sees it.
    Reflect.apply(Reflect.get(console, "log"), console, ["from the console", 1]);
    process.stdout.write("direct to stdout\n");
    process.stderr.write("direct to stderr\n");
    const lines = capture.stop();

    expect(lines).toEqual(["from the console 1", "direct to stdout\n", "direct to stderr\n"]);
  });

  it("restores the console and the streams when it stops", () => {
    startConsoleCapture().stop();

    expect(vi.isMockFunction(Reflect.get(console, "log"))).toBe(false);
    expect(vi.isMockFunction(Reflect.get(process.stdout, "write"))).toBe(false);
    expect(vi.isMockFunction(Reflect.get(process.stderr, "write"))).toBe(false);
  });
});
