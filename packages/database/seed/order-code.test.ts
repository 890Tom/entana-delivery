import { describe, expect, it } from "vitest";
import { ORDER_CODE_ALPHABET, ORDER_CODE_LENGTH, isValidOrderCode } from "./order-code.ts";

describe("order code alphabet", () => {
  it.each(["0", "O", "1", "I"])("does not contain the ambiguous character %s", (character) => {
    expect(ORDER_CODE_ALPHABET).not.toContain(character);
  });

  it("has no duplicate character", () => {
    expect(new Set(ORDER_CODE_ALPHABET).size).toBe(ORDER_CODE_ALPHABET.length);
  });

  it("has 6 characters per code", () => {
    expect(ORDER_CODE_LENGTH).toBe(6);
  });
});

describe("isValidOrderCode", () => {
  it("accepts 6 characters of the alphabet", () => {
    expect(isValidOrderCode("DEMA22")).toBe(true);
  });

  it.each([
    ["too short", "DEMA2"],
    ["too long", "DEMA222"],
    ["a zero", "DEMA20"],
    ["a letter O", "DEMAO2"],
    ["a one", "DEMA21"],
    ["a letter I", "DEMAI2"],
    ["lower case", "dema22"],
    ["empty", ""],
  ])("rejects a code that is %s", (_label, code) => {
    expect(isValidOrderCode(code)).toBe(false);
  });
});
