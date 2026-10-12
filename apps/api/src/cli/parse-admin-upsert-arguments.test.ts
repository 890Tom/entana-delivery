import { describe, expect, it } from "vitest";
import { ADMIN_UPSERT_USAGE, parseAdminUpsertArguments } from "./parse-admin-upsert-arguments.js";

describe("parseAdminUpsertArguments", () => {
  it("reads the e-mail, normalised, with no other option", () => {
    expect(parseAdminUpsertArguments([" Ana@Example.MG "])).toEqual({
      isValid: true,
      arguments: { email: "ana@example.mg", displayName: undefined, isDisable: false },
    });
  });

  it("reads the name and the disable flag", () => {
    expect(parseAdminUpsertArguments(["ana@example.mg", "--name", "Ana R.", "--disable"])).toEqual({
      isValid: true,
      arguments: { email: "ana@example.mg", displayName: "Ana R.", isDisable: true },
    });
  });

  it("refuses an e-mail that is not valid without repeating it", () => {
    const result = parseAdminUpsertArguments(["not-an-email"]);
    expect(result).toEqual({ isValid: false, message: "The e-mail address is not valid." });
  });

  it.each([
    ["no e-mail", []],
    ["two e-mails", ["a@example.mg", "b@example.mg"]],
    ["an option that does not exist", ["a@example.mg", "--password", "secret-value-123"]],
  ])("shows the usage for %s", (_label, argv) => {
    const result = parseAdminUpsertArguments(argv);
    expect(result).toEqual({ isValid: false, message: ADMIN_UPSERT_USAGE });
    expect(JSON.stringify(result)).not.toContain("secret-value-123");
  });
});
