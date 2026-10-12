import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "./session-token.js";

describe("generateSessionToken", () => {
  it("is 43 base64url characters (32 bytes)", () => {
    expect(generateSessionToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("is different every time", () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });
});

describe("hashSessionToken", () => {
  it("is the SHA-256 in lowercase hexadecimal, and is not the token", () => {
    const token = "A".repeat(43);
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash);
  });
});
