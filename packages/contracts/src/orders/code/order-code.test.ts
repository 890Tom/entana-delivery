import { describe, expect, it, vi } from "vitest";
import {
  ORDER_CODE_ALPHABET,
  ORDER_CODE_LENGTH,
  generateOrderCode,
  orderCodeSchema,
} from "./order-code.js";

const sourceReturning = (bytes: readonly number[]): ((count: number) => Uint8Array) => {
  return () => Uint8Array.from(bytes);
};

describe("ORDER_CODE_ALPHABET", () => {
  it("has 32 distinct characters, so that byte & 31 is unbiased", () => {
    expect(ORDER_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(ORDER_CODE_ALPHABET).size).toBe(32);
  });

  it("is the letters A-Z without I and O, then the digits 2 to 9", () => {
    expect(ORDER_CODE_ALPHABET).toBe("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
  });

  it.each(["0", "O", "1", "I"])("does not contain the confusable character %s", (character) => {
    expect(ORDER_CODE_ALPHABET).not.toContain(character);
  });
});

describe("generateOrderCode", () => {
  it("asks the random source for exactly 6 bytes", () => {
    const source = vi.fn(sourceReturning([0, 0, 0, 0, 0, 0]));
    generateOrderCode(source);
    expect(source).toHaveBeenCalledExactlyOnceWith(ORDER_CODE_LENGTH);
  });

  it("maps byte 0 to A and byte 31 to 9", () => {
    expect(generateOrderCode(sourceReturning([0, 0, 0, 0, 0, 0]))).toBe("AAAAAA");
    expect(generateOrderCode(sourceReturning([31, 31, 31, 31, 31, 31]))).toBe("999999");
  });

  it("maps the last letter Z at byte 23 and the first digit 2 at byte 24", () => {
    expect(generateOrderCode(sourceReturning([23, 24, 0, 0, 0, 0]))).toBe("Z2AAAA");
  });

  it("keeps the 5 low bits of a byte", () => {
    expect(generateOrderCode(sourceReturning([32, 255, 64, 33, 128, 224]))).toBe("A9ABAA");
  });

  it("gives each of the 32 characters exactly 8 times over the 256 byte values", () => {
    const counts = new Map<string, number>();
    for (let byte = 0; byte < 256; byte += 1) {
      const character = generateOrderCode(sourceReturning(Array<number>(6).fill(byte))).charAt(0);
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(Array.from(ORDER_CODE_ALPHABET).sort());
    expect([...counts.values()].every((count) => count === 8)).toBe(true);
  });

  it("returns 6 characters, all in the alphabet", () => {
    const code = generateOrderCode(sourceReturning([200, 1, 77, 130, 9, 250]));
    expect(code).toHaveLength(ORDER_CODE_LENGTH);
    expect(Array.from(code).every((character) => ORDER_CODE_ALPHABET.includes(character))).toBe(
      true,
    );
  });

  it.each([5, 7, 0])("throws a RangeError when the source returns %i bytes", (length) => {
    expect(() => generateOrderCode(() => new Uint8Array(length))).toThrow(RangeError);
  });
});

describe("orderCodeSchema", () => {
  it("accepts a generated code", () => {
    const code = generateOrderCode(sourceReturning([3, 14, 15, 9, 26, 5]));
    expect(orderCodeSchema.safeParse(code).success).toBe(true);
  });

  it.each([
    ["too short", "ABCDE"],
    ["too long", "ABCDEFG"],
    ["lowercase", "abcdef"],
    ["the letter O", "ABCDEO"],
    ["the letter I", "ABCDEI"],
    ["the digit 0", "ABCDE0"],
    ["the digit 1", "ABCDE1"],
    ["a space", "ABCDE "],
    ["an empty string", ""],
    ["a number", 123456],
  ])("rejects a code that is %s", (_label, value) => {
    expect(orderCodeSchema.safeParse(value).success).toBe(false);
  });
});
