import { describe, expect, it } from "vitest";
import { assertSqlIdentifier } from "./sql.ts";

describe("assertSqlIdentifier", () => {
  it.each(["customer", "customer_order", "phone_e164", "radius_m"])("accepts %s", (name) => {
    expect(assertSqlIdentifier(name)).toBe(name);
  });

  it.each([
    ["a double quote", 'customer"'],
    ["a space", "customer order"],
    ["a semicolon", "customer;DROP TABLE customer"],
    ["upper case", "Customer"],
    ["a leading digit", "1customer"],
    ["a dash", "customer-order"],
    ["empty", ""],
  ])("refuses a name with %s", (_label, name) => {
    expect(() => assertSqlIdentifier(name)).toThrow(RangeError);
  });
});
