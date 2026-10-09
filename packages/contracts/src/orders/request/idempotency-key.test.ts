import { describe, expect, it } from "vitest";
import { idempotencyKeySchema } from "./idempotency-key.js";

describe("idempotencyKeySchema", () => {
  it.each([
    ["a version 4 uuid", "3b241101-e2bb-4255-8caf-4136c566a962"],
    ["a version 7 uuid", "0190a5b2-7c3d-7e4f-8a1b-2c3d4e5f6a7b"],
  ])("accepts %s", (_label, value) => {
    expect(idempotencyKeySchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["free text", "my-key-1"],
    ["a uuid with a trailing space", "3b241101-e2bb-4255-8caf-4136c566a962 "],
    ["a number", 42],
    ["undefined", undefined],
  ])("rejects %s", (_label, value) => {
    expect(idempotencyKeySchema.safeParse(value).success).toBe(false);
  });
});
