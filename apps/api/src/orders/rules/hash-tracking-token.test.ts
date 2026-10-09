import { describe, expect, it } from "vitest";
import { hashTrackingToken } from "./hash-tracking-token.js";

describe("hashTrackingToken", () => {
  it("returns the SHA-256 of the token as 64 lowercase hex characters", () => {
    // Reference value of SHA-256("abc"), from FIPS 180-2.
    expect(hashTrackingToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("gives the same hash for the same token", () => {
    expect(hashTrackingToken("token-a")).toBe(hashTrackingToken("token-a"));
  });

  it("gives another hash for another token", () => {
    expect(hashTrackingToken("token-a")).not.toBe(hashTrackingToken("token-b"));
  });

  it("does not contain the token", () => {
    const token = "FAKE".padEnd(43, "0");
    expect(hashTrackingToken(token)).not.toContain(token);
  });
});
