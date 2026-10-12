import { describe, expect, it } from "vitest";
import { canSelectAll, hasToProcessSection, tableStatuses } from "./order-tabs";

describe("the tabs of the orders", () => {
  it("asks for every status but NEW in the table of Toutes", () => {
    expect(tableStatuses("all")).toEqual([
      "CONFIRMED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "REJECTED",
      "CANCELLED",
      "FAILED",
    ]);
  });

  it("groups refused, cancelled and failed orders in one tab", () => {
    expect(tableStatuses("closed")).toEqual(["REJECTED", "CANCELLED", "FAILED"]);
  });

  it("has no table in À traiter, which shows the cards", () => {
    expect(tableStatuses("toProcess")).toBeNull();
    expect([hasToProcessSection("all"), hasToProcessSection("toProcess")]).toEqual([true, true]);
    expect(hasToProcessSection("confirmed")).toBe(false);
  });

  it("selects every loaded row only in the tabs of one actionable status", () => {
    expect(canSelectAll("confirmed")).toBe(true);
    expect(canSelectAll("outForDelivery")).toBe(true);
    expect(canSelectAll("all")).toBe(false);
    expect(canSelectAll("delivered")).toBe(false);
  });
});
