import { inject } from "vitest";
import type { Response } from "supertest";
import { collectLeafValues } from "./forbidden-strings.js";
import type { CapturedOutput, OutputName, OutputPart } from "./forbidden-strings.js";

export const INFO_LEVEL = 30;
export const ERROR_LEVEL = 50;
const MINIMUM_NAME_LENGTH = 6;
// pino adds these to every line; the database controls none of them, and a process id or a
// timestamp could by chance hold a digit run that looks like a code.
const PINO_BASE_FIELDS: ReadonlySet<string> = new Set(["time", "pid", "hostname"]);

export function withoutPinoBaseFields(entry: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(entry).filter(([key]) => !PINO_BASE_FIELDS.has(key)));
}

export function isAccessLine(entry: Record<string, unknown>): boolean {
  return "responseTime" in entry;
}

export function stringHeaderValues(response: Response): string[] {
  return Object.values(response.headers).flatMap((value: unknown) =>
    Array.isArray(value) ? value.map(String) : [String(value)],
  );
}

export function partOfLines(
  name: OutputName,
  lines: readonly Record<string, unknown>[],
): OutputPart {
  return {
    name,
    rawTexts: lines.map((line) => JSON.stringify(line)),
    values: lines.flatMap((line) => collectLeafValues(line)),
  };
}

export function partOfLine(name: OutputName, line: Record<string, unknown>): CapturedOutput {
  return [partOfLines(name, [line])];
}

export function schemaWords(): { table: string; column: string; constraint: string } {
  const objects = inject("schemaObjects");
  const longEnough = (names: readonly string[]): string =>
    names.find((name) => name.length >= MINIMUM_NAME_LENGTH) ?? "";
  return {
    table: longEnough(objects.tables),
    column: longEnough(objects.columns),
    constraint: longEnough(objects.constraints),
  };
}
