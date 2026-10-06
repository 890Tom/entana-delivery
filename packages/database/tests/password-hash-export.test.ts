import { describe, expect, it } from "vitest";

describe("@entana/database", () => {
  it("no longer exposes the password hashing module (it lives in @entana/password-hash)", async () => {
    const formerSpecifier = "@entana/database/password-hash";
    await expect(import(/* @vite-ignore */ formerSpecifier)).rejects.toThrow();
  });
});
