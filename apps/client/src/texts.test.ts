import { describe, expect, it } from "vitest";

import { CATALOGUE_ERROR_KINDS } from "./catalogue/fetch-products";
import { texts } from "./texts";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

describe("texts", () => {
  it("has no blank text", () => {
    const strings = collectStrings(texts);

    expect(strings.length).toBeGreaterThan(0);
    expect(strings.filter((text) => text.trim() === "")).toStrictEqual([]);
  });

  it("has a different message for every kind of catalogue error", () => {
    const messages = CATALOGUE_ERROR_KINDS.map((kind) => texts.catalogue.errors[kind]);

    expect(new Set(messages).size).toBe(CATALOGUE_ERROR_KINDS.length);
  });

  it("uses the wording of the specification for a sold-out product", () => {
    expect(texts.catalogue.soldOut).toBe("Épuisé");
  });
});
