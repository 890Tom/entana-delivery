import { describe, expect, it } from "vitest";
import { adminOrderListQuerySchema } from "./admin-order-list.js";

const parseQ = (q: string): unknown => adminOrderListQuerySchema.parse({ q }).q;

describe("the search text of the order list", () => {
  it("searches a name with letters, spaces, hyphens and apostrophes, trimmed", () => {
    expect(parseQ("  Jean-Marie N'Doye ")).toEqual({ kind: "name", text: "Jean-Marie N'Doye" });
  });

  it("accepts accented letters", () => {
    expect(parseQ("Éloïse")).toEqual({ kind: "name", text: "Éloïse" });
  });

  it("searches a local phone number without its leading zero", () => {
    expect(parseQ("034 12 345 67")).toEqual({ kind: "phone", digits: "341234567" });
  });

  it("searches an E.164 number by its digits", () => {
    expect(parseQ("+261.34-12 345")).toEqual({ kind: "phone", digits: "2613412345" });
  });

  it.each([
    ["one character", "a"],
    ["one character around spaces", "  a  "],
    ["more than 50 characters", "a".repeat(51)],
    ["a letter and a digit", "Rakoto2"],
    ["a wildcard", "Rak%"],
    ["an underscore", "Rak_to"],
    ["a punctuation without letter", "--"],
    ["two digits only", "12"],
    ["two digits once the leading zero is gone", "034"],
    ["spaces only", "   "],
  ])("refuses %s", (_label, q) => {
    expect(adminOrderListQuerySchema.safeParse({ q }).success).toBe(false);
  });
});

describe("the filters of the order list", () => {
  it("reads several statuses and ignores a duplicate", () => {
    const query = adminOrderListQuerySchema.parse({ status: "REJECTED,CANCELLED,REJECTED" });

    expect(query.status).toEqual(["REJECTED", "CANCELLED"]);
  });

  it.each([
    ["an unknown status in a list", "NEW,DONE"],
    ["an empty item", "NEW,"],
    ["an empty value", ""],
  ])("refuses %s", (_label, status) => {
    expect(adminOrderListQuerySchema.safeParse({ status }).success).toBe(false);
  });

  it("reads a day", () => {
    expect(adminOrderListQuerySchema.parse({ date: "2026-10-08" }).date).toBe("2026-10-08");
  });

  it.each(["2026-13-01", "2026-02-30", "08/10/2026", "2026-10-08T10:00:00Z"])(
    "refuses the day %j",
    (date) => {
      expect(adminOrderListQuerySchema.safeParse({ date }).success).toBe(false);
    },
  );
});
