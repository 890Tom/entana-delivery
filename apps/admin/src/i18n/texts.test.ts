import { describe, expect, it } from "vitest";

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

  it("gives a wrong password no more detail than any other refused sign-in", () => {
    expect(texts.login.wrongCredentials).toBe("Identifiant ou mot de passe incorrect.");
  });
});
