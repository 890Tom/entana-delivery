import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as generated from "./generated/enums.js";

const dataModel = readFileSync(new URL("../../../docs/data-model.md", import.meta.url), "utf8");

// The status enum is written inline in a table row, the others in a "enum `A`, `B`" cell.
function backtickedValues(text: string): string[] {
  return [...text.matchAll(/`([A-Z_]+)`/g)].map((match) => match[1] ?? "");
}

function tableSection(tableName: string): string {
  const start = dataModel.indexOf(`### \`${tableName}\``);
  if (start === -1) throw new Error(`Table ${tableName} not found in docs/data-model.md`);
  const next = dataModel.indexOf("\n###", start + 1);
  return dataModel.slice(start, next === -1 ? undefined : next);
}

function rowOf(tableName: string, column: string): string {
  const row = tableSection(tableName)
    .split("\n")
    .find((line) => line.startsWith(`| ${column} |`));
  if (row === undefined) throw new Error(`Column ${column} not found in ${tableName}`);
  return row;
}

function enumValues(enumObject: Record<string, string>): string[] {
  return Object.values(enumObject);
}

const documented: Record<string, { actual: Record<string, string>; expected: string[] }> = {
  TrustLevel: {
    actual: generated.TrustLevel,
    expected: backtickedValues(rowOf("customer", "trust_level").split("|")[2] ?? ""),
  },
  OrderStatus: {
    actual: generated.OrderStatus,
    expected: backtickedValues(rowOf("customer_order", "status").split("|")[3] ?? ""),
  },
  FeeReason: {
    actual: generated.FeeReason,
    expected: backtickedValues(rowOf("customer_order", "fee_reason").split("|")[2] ?? ""),
  },
  OrderEventType: {
    actual: generated.OrderEventType,
    expected: backtickedValues(rowOf("order_event", "type").split("|")[2] ?? ""),
  },
  ActorType: {
    actual: generated.ActorType,
    expected: backtickedValues(rowOf("order_event", "actor_type").split("|")[2] ?? ""),
  },
  StaffRole: {
    actual: generated.StaffRole,
    expected: backtickedValues(rowOf("staff_user", "role").split("|")[2] ?? ""),
  },
};

describe("Prisma enums match docs/data-model.md", () => {
  for (const [name, { actual, expected }] of Object.entries(documented)) {
    it(`${name} exposes exactly the documented values`, () => {
      expect(expected.length).toBeGreaterThan(0);
      expect(enumValues(actual)).toEqual(expected);
    });
  }

  it("covers every enum exported by the generated client", () => {
    expect(Object.keys(documented).sort()).toEqual(Object.keys(generated).sort());
  });
});
