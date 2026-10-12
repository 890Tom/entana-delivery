import { describe, expect, it } from "vitest";

import { readLoginForm } from "./read-login-form";

describe("readLoginForm", () => {
  it("accepts a valid identifier and password, and normalises the address", () => {
    const reading = readLoginForm({ identifier: "  Gerante@Example.MG ", password: "secret" });

    expect(reading).toEqual({
      isValid: true,
      request: { email: "gerante@example.mg", password: "secret" },
    });
  });

  it("asks for each empty field, whitespace included", () => {
    const reading = readLoginForm({ identifier: "   ", password: "" });

    expect(reading).toEqual({ isValid: false, identifier: "required", password: "required" });
  });

  it("refuses an identifier that is not an address, and keeps the password out of it", () => {
    const reading = readLoginForm({ identifier: "gerante", password: "secret" });

    expect(reading).toEqual({ isValid: false, identifier: "invalid", password: undefined });
  });

  it("refuses a password of more than 128 characters, counting emoji once", () => {
    const accepted = readLoginForm({ identifier: "a@example.mg", password: "😀".repeat(128) });
    const refused = readLoginForm({ identifier: "a@example.mg", password: "x".repeat(129) });

    expect(accepted.isValid).toBe(true);
    expect(refused).toEqual({ isValid: false, identifier: undefined, password: "too-long" });
  });
});
