import { describe, expect, it } from "vitest";

import { isValidLandmark } from "./validate-landmark";

describe("isValidLandmark", () => {
  it.each([
    ["three characters", "abc"],
    ["three characters between spaces", "  abc  "],
    ["the longest text of the contract", "a".repeat(200)],
  ])("accepts %s", (_label, text) => {
    expect(isValidLandmark(text)).toBe(true);
  });

  it.each([
    ["nothing", ""],
    ["only spaces", "     "],
    ["two characters between spaces", "  ab  "],
    ["more than the contract allows", "a".repeat(201)],
    ["a control character", "portail\u0007bleu"],
    ["an invisible character", "portail​bleu"],
  ])("refuses %s", (_label, text) => {
    expect(isValidLandmark(text)).toBe(false);
  });
});
