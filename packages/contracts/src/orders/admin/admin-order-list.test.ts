import { describe, expect, it } from "vitest";
import { decodeOrderCursor, encodeOrderCursor } from "./admin-order-cursor.js";
import { adminOrderListQuerySchema } from "./admin-order-list.js";

const ORDER_ID = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5f";

describe("the order cursor", () => {
  it("returns the id it was made from", () => {
    expect(decodeOrderCursor(encodeOrderCursor(ORDER_ID))).toBe(ORDER_ID);
  });

  it.each(["", "not a cursor", ORDER_ID])("refuses %j, which this API did not issue", (cursor) => {
    expect(decodeOrderCursor(cursor)).toBeNull();
  });
});

describe("adminOrderListQuerySchema", () => {
  it("defaults the limit to 25", () => {
    expect(adminOrderListQuerySchema.parse({})).toEqual({ limit: 25 });
  });

  it("reads the limit, the status and the cursor", () => {
    const query = { status: "NEW", limit: "100", cursor: encodeOrderCursor(ORDER_ID) };

    expect(adminOrderListQuerySchema.parse(query)).toEqual({
      status: "NEW",
      limit: 100,
      cursor: ORDER_ID,
    });
  });

  it.each([
    ["a limit over 100", { limit: "101" }],
    ["a limit of 0", { limit: "0" }],
    ["a limit that is not a number", { limit: "ten" }],
    ["a status that does not exist", { status: "DONE" }],
    ["a cursor that is not one", { cursor: "abc" }],
    ["a parameter that is not allowed", { search: "a" }],
  ])("refuses %s", (_label, query) => {
    expect(adminOrderListQuerySchema.safeParse(query).success).toBe(false);
  });
});
