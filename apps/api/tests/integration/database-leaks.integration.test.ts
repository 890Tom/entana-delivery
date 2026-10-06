import { isDeepStrictEqual } from "node:util";
import type { DatabaseErrorKind } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { captureLogs } from "../e2e/support/log-capture.js";
import { buildTestConfig } from "../e2e/support/test-config.js";
import { fixedDatabaseProblem } from "../support/fixed-database-problems.js";
import { startConsoleCapture } from "./support/console-capture.js";
import { PROBE_PATHS, UsedValues } from "./support/failure-cases.module.js";
import {
  NO_EXEMPTIONS,
  OUTPUT_NAMES,
  buildForbiddenStrings,
  collectLeafValues,
  countForbiddenStrings,
  findLeak,
  findNamesIgnoredAsKeys,
  listExemptions,
  observeBaseline,
} from "./support/forbidden-strings.js";
import type { CapturedOutput, Exemptions, ForbiddenStrings } from "./support/forbidden-strings.js";
import {
  ERROR_LEVEL,
  INFO_LEVEL,
  isAccessLine,
  partOfLine,
  partOfLines,
  stringHeaderValues,
  withoutPinoBaseFields,
} from "./support/output-parts.js";
import { startAppWithFailureCases } from "./support/start-app.js";

const FAILURE_MESSAGE = "Database operation failed.";
const BASELINE_PATH = PROBE_PATHS.baseline;
const MINIMUM_PASSWORD_LENGTH = 6;
interface ViolationCase {
  readonly name: string;
  readonly path: string;
  readonly kind: DatabaseErrorKind;
  readonly status: number;
  readonly logLevel: number;
}

const violationCases: readonly ViolationCase[] = [
  {
    name: "a unique violation",
    path: PROBE_PATHS.unique,
    kind: "unique_violation",
    status: 409,
    logLevel: INFO_LEVEL,
  },
  {
    name: "a foreign key violation",
    path: PROBE_PATHS.foreignKey,
    kind: "foreign_key_violation",
    status: 409,
    logLevel: INFO_LEVEL,
  },
  {
    name: "a check violation",
    path: PROBE_PATHS.check,
    kind: "check_violation",
    status: 500,
    logLevel: ERROR_LEVEL,
  },
  {
    name: "a not-null violation",
    path: PROBE_PATHS.notNull,
    kind: "not_null_violation",
    status: 500,
    logLevel: ERROR_LEVEL,
  },
  {
    name: "a missing record",
    path: PROBE_PATHS.notFound,
    kind: "record_not_found",
    status: 404,
    logLevel: INFO_LEVEL,
  },
];

describe("real PostgreSQL violations through the real API", () => {
  const logs = captureLogs();
  const summary: string[] = [];
  let app: NestExpressApplication | undefined;
  let usedValues: UsedValues | undefined;
  let exemptions: Exemptions = NO_EXEMPTIONS;
  let baselineOutput: CapturedOutput = [];
  const keyOnlyNames = new Set<string>();

  function databasePassword(): string {
    return decodeURIComponent(new URL(inject("schemaConnectionString")).password);
  }

  function forbiddenStrings(): ForbiddenStrings {
    return buildForbiddenStrings({
      schemaName: inject("temporarySchema"),
      schemaObjects: inject("schemaObjects"),
      usedValues: usedValues?.all() ?? [],
      password: databasePassword(),
      connectionString: inject("schemaConnectionString"),
    });
  }

  // Sends one request and gathers every output of it: headers, body, the access line, the other
  // log lines, and whatever was written to the console meanwhile.
  async function requestAndCapture(
    path: string,
  ): Promise<{ response: Response; output: CapturedOutput }> {
    logs.reset();
    const consoleCapture = startConsoleCapture();
    let response: Response;
    try {
      if (app === undefined) throw new Error("The application is not started yet.");
      response = await request(app.getHttpServer()).get(path);
    } catch (error) {
      consoleCapture.stop();
      throw error;
    }
    const consoleLines = consoleCapture.stop();
    const entries = logs.entries().map(withoutPinoBaseFields);
    const output: CapturedOutput = [
      {
        name: "headers",
        rawTexts: [JSON.stringify(response.headers)],
        values: stringHeaderValues(response),
      },
      { name: "body", rawTexts: [response.text], values: collectLeafValues(response.body) },
      partOfLines("access log", entries.filter(isAccessLine)),
      partOfLines(
        "failure log",
        entries.filter((entry) => !isAccessLine(entry)),
      ),
      { name: "console", rawTexts: consoleLines, values: consoleLines },
    ];
    return { response, output };
  }

  beforeAll(async () => {
    const config = buildTestConfig({
      DATABASE_URL: inject("schemaConnectionString"),
      LOG_LEVEL: "info",
    });
    app = await startAppWithFailureCases(config, logs.stream);
    usedValues = app.get(UsedValues, { strict: false });
    // Once per suite: an unknown, non-database failure through the same filter. What the broad
    // names found in each of its outputs are legitimate there, in that output only.
    const baseline = await requestAndCapture(BASELINE_PATH);
    baselineOutput = baseline.output;
    exemptions = observeBaseline(forbiddenStrings(), baseline.output);
  });

  afterAll(async () => {
    await app?.close();
    const exempted = listExemptions(exemptions).map(({ output, name }) => `${name}: ${output}`);
    process.stdout.write(
      [
        ...summary,
        databasePassword().length < MINIMUM_PASSWORD_LENGTH
          ? "The password was NOT looked for: it is empty or shorter than the floor."
          : "The password was looked for (decoded and as written in a URL).",
        `Names exempted by the baseline, per output: ${exempted.join("; ") || "none"}.`,
        `Names ignored by the value scan because they only appear as keys: ${[...keyOnlyNames].sort().join(", ") || "none"}.`,
        "",
      ].join("\n"),
    );
  });

  describe("the baseline control", () => {
    it("is a real 5xx through the same filter, so its outputs are the real ones", async () => {
      const { response } = await requestAndCapture(BASELINE_PATH);

      expect(response.status).toBe(500);
      // Compared through a boolean: a failure must never print what the API sent.
      expect(isDeepStrictEqual(response.body, fixedDatabaseProblem("unknown", BASELINE_PATH))).toBe(
        true,
      );
    });

    it("has something to exempt: the helmet headers and the text of pino-http", () => {
      expect(listExemptions(exemptions).length).toBeGreaterThan(0);
    });

    it("never exempts a table, a constraint or an index name", () => {
      const objects = inject("schemaObjects");
      const schemaNames = [...objects.tables, ...objects.constraints, ...objects.indexes].map(
        (name) => name.toLowerCase(),
      );

      const exempted = listExemptions(exemptions).map(({ name }) => name);

      expect(exempted.filter((name) => schemaNames.includes(name))).toEqual([]);
    });

    it("holds no high-signal string: the raw scan finds nothing in it", () => {
      expect(findLeak(forbiddenStrings(), baselineOutput, exemptions)).toBeUndefined();
    });

    it("does not let any exempted name through in another output", () => {
      const forbidden = forbiddenStrings();

      for (const { output, name } of listExemptions(exemptions)) {
        const elsewhere = OUTPUT_NAMES.filter((candidate) => candidate !== output);
        const flagged = elsewhere.map((candidate) =>
          findLeak(forbidden, partOfLine(candidate, { value: name }), exemptions),
        );

        expect(flagged).toEqual(elsewhere.map(() => name));
      }
    });
  });

  it.each(violationCases)("keeps $name from leaking anything", async (violation) => {
    const { response, output } = await requestAndCapture(violation.path);

    // First, so that a leak is what a failure shows (the forbidden string, never its context).
    const forbidden = forbiddenStrings();
    expect(findLeak(forbidden, output, exemptions)).toBeUndefined();
    summary.push(
      `${violation.kind}: ${String(countForbiddenStrings(forbidden))} forbidden strings checked.`,
    );
    expect(countForbiddenStrings(forbidden)).toBeGreaterThan(violationCases.length);
    findNamesIgnoredAsKeys(forbidden, output).forEach((name) => keyOnlyNames.add(name));

    expect(response.status).toBe(violation.status);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    // Compared through booleans: a failure must never print what the API sent or logged.
    const expectedBody = fixedDatabaseProblem(violation.kind, violation.path);
    expect(isDeepStrictEqual(response.body, expectedBody)).toBe(true);

    // The access log (it has a response time) is separate: the filter writes exactly one other line.
    const entries = logs.entries();
    const failureLines = entries.filter((entry) => !isAccessLine(entry));
    expect(failureLines).toHaveLength(1);
    expect(entries.filter(isAccessLine)).toHaveLength(1);
    const { req, context, ...failureLine } = withoutPinoBaseFields(failureLines[0] ?? {});
    expect(typeof context).toBe("string");
    const binding: unknown = req;
    const bindingKeys =
      typeof binding === "object" && binding !== null ? Object.keys(binding).sort() : [];
    expect(isDeepStrictEqual(bindingKeys, ["id", "method"])).toBe(true);
    const expectedLine = {
      level: violation.logLevel,
      reason: violation.kind,
      msg: FAILURE_MESSAGE,
    };
    expect(isDeepStrictEqual(failureLine, expectedLine)).toBe(true);
  });
});
