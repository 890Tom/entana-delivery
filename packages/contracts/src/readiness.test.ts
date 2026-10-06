import { describe, expect, it } from "vitest";
import { readinessResponseSchema } from "./readiness.js";

describe("readinessResponseSchema", () => {
  it("accepts a ready response", () => {
    expect(readinessResponseSchema.safeParse({ status: "ready" }).success).toBe(true);
  });

  it.each([
    ["another status", { status: "ok" }],
    ["a status in another case", { status: "READY" }],
    ["an empty object", {}],
    ["an extra property naming a component", { status: "ready", database: "up" }],
    ["null", null],
    ["a string", "ready"],
    ["an array", [{ status: "ready" }]],
  ])("refuses %s", (_label, body) => {
    expect(readinessResponseSchema.safeParse(body).success).toBe(false);
  });
});
