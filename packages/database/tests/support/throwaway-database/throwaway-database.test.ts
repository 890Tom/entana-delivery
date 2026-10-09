import { describe, expect, it } from "vitest";
import { generateThrowawayDatabaseName, isThrowawayDatabaseName } from "./throwaway-database.js";

describe("the throwaway database name", () => {
  it("is generated as test_ and sixteen lowercase hex characters", () => {
    expect(generateThrowawayDatabaseName()).toMatch(/^test_[0-9a-f]{16}$/);
  });

  it("differs from one call to the next", () => {
    expect(generateThrowawayDatabaseName()).not.toBe(generateThrowawayDatabaseName());
  });

  it.each(["test_0a1b", "test_0123456789abcdef"])("accepts %j", (name) => {
    expect(isThrowawayDatabaseName(name)).toBe(true);
  });

  it.each([
    "",
    "entana",
    "postgres",
    "test_",
    "test_ABC",
    "TEST_abc",
    "test_abc;drop",
    'test_a"b',
    "xtest_abc",
    "test_abc ",
    "test_abc\n",
  ])("does not accept %j", (name) => {
    expect(isThrowawayDatabaseName(name)).toBe(false);
  });
});
