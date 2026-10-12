import { describe, expect, it } from "vitest";
import {
  adminLoginRequestSchema,
  normalizeEmail,
  validateAdminPassword,
} from "./admin-credentials.js";

describe("normalizeEmail", () => {
  it("trims and lowercases, so that one person has one key", () => {
    expect(normalizeEmail("  Ana.Rakoto@Example.MG ")).toBe("ana.rakoto@example.mg");
  });
});

describe("validateAdminPassword", () => {
  it.each([
    ["11 characters", "a".repeat(11), "too-short"],
    ["129 characters", "a".repeat(129), "too-long"],
  ])("refuses %s", (_label, password, reason) => {
    expect(validateAdminPassword(password)).toEqual({ isValid: false, reason });
  });

  it.each([
    ["12 characters", "a".repeat(12)],
    ["128 characters", "a".repeat(128)],
    ["only spaces and digits: no composition rule", " ".repeat(6) + "1".repeat(6)],
  ])("accepts %s", (_label, password) => {
    expect(validateAdminPassword(password)).toEqual({ isValid: true });
  });

  it("counts characters, not UTF-16 units", () => {
    expect(validateAdminPassword("😀".repeat(12))).toEqual({ isValid: true });
    expect(validateAdminPassword("😀".repeat(129))).toEqual({ isValid: false, reason: "too-long" });
  });
});

describe("adminLoginRequestSchema", () => {
  const parse = (body: unknown): ReturnType<typeof adminLoginRequestSchema.safeParse> =>
    adminLoginRequestSchema.safeParse(body);

  it("normalizes the e-mail and keeps the password as typed", () => {
    expect(parse({ email: " Ana@Example.MG ", password: " Secret " })).toMatchObject({
      success: true,
      data: { email: "ana@example.mg", password: " Secret " },
    });
  });

  it("accepts a short password: the policy applies when it is set, not when it is checked", () => {
    expect(parse({ email: "ana@example.mg", password: "x" }).success).toBe(true);
  });

  it.each([
    ["an empty password", { email: "ana@example.mg", password: "" }],
    ["a password of 129 characters", { email: "ana@example.mg", password: "a".repeat(129) }],
    ["a password that is not a string", { email: "ana@example.mg", password: 1234 }],
    ["an e-mail that is not an address", { email: "ana", password: "x" }],
    ["an e-mail that is too long", { email: `${"a".repeat(250)}@x.mg`, password: "x" }],
    ["a field that is not expected", { email: "ana@example.mg", password: "x", admin: true }],
    ["a body that is not an object", "ana@example.mg"],
  ])("refuses %s", (_label, body) => {
    expect(parse(body).success).toBe(false);
  });
});
