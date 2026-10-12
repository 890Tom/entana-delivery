import { describe, expect, it } from "vitest";
import { adminOrderSummaryQuerySchema } from "./admin-order-summary.js";

const ORDER_ID = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5f";

describe("adminOrderSummaryQuerySchema", () => {
  it("accepts no parameter", () => {
    expect(adminOrderSummaryQuerySchema.parse({})).toEqual({});
  });

  it("reads the id of the last order the screen has seen", () => {
    expect(adminOrderSummaryQuerySchema.parse({ since: ORDER_ID })).toEqual({ since: ORDER_ID });
  });

  it.each([
    ["an id that is not a uuid", { since: "abc" }],
    ["a parameter that is not allowed", { limit: "1" }],
  ])("refuses %s", (_label, query) => {
    expect(adminOrderSummaryQuerySchema.safeParse(query).success).toBe(false);
  });
});
