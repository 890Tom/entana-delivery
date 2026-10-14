import { MAX_FREE_DELIVERY_MIN_PIECES, PRODUCT_PRICE_MAX_AR } from "@entana/contracts";
import type { DeliverySettings } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { formValuesOf, hasChanges, planSettingsPatch, readCountInput } from "./settings-form";

const SAVED: DeliverySettings = {
  outOfAxisFeeAr: 4000,
  freeDeliveryMinPieces: 10,
  outOfAxisMessage: "Des frais s'appliquent.",
};

describe("the values of the settings form", () => {
  it("writes the saved numbers as digits", () => {
    expect(formValuesOf(SAVED)).toEqual({
      outOfAxisFeeAr: "4000",
      freeDeliveryMinPieces: "10",
      outOfAxisMessage: "Des frais s'appliquent.",
    });
  });
});

describe("the count field", () => {
  it("keeps the digits only", () => {
    expect(readCountInput(" 1 2a-")).toBe("12");
  });
});

describe("the detection of a change", () => {
  it("sees no change in the saved values", () => {
    expect(hasChanges(SAVED, formValuesOf(SAVED))).toBe(false);
  });

  it("sees an emptied fee as a change", () => {
    expect(hasChanges(SAVED, { outOfAxisFeeAr: "" })).toBe(true);
  });
});

describe("the request of the settings form", () => {
  it("sends only the fee when only the fee changed", () => {
    const plan = planSettingsPatch(SAVED, { ...formValuesOf(SAVED), outOfAxisFeeAr: "5000" });

    expect(plan).toEqual({ kind: "ready", body: { outOfAxisFeeAr: 5000 } });
  });

  it("sends the message without the spaces around it", () => {
    const plan = planSettingsPatch(SAVED, { outOfAxisMessage: "  Nouveau message.  " });

    expect(plan).toEqual({ kind: "ready", body: { outOfAxisMessage: "Nouveau message." } });
  });

  it("asks nothing when nothing changed", () => {
    expect(planSettingsPatch(SAVED, formValuesOf(SAVED))).toEqual({ kind: "unchanged" });
  });

  it("accepts a free delivery everywhere: a fee of zero", () => {
    expect(planSettingsPatch(SAVED, { outOfAxisFeeAr: "0" })).toEqual({
      kind: "ready",
      body: { outOfAxisFeeAr: 0 },
    });
  });

  it.each([
    ["negative", "-1"],
    ["empty", ""],
    ["above the highest price", String(PRODUCT_PRICE_MAX_AR + 1)],
  ])("refuses a fee that is %s", (_case, fee) => {
    expect(planSettingsPatch(SAVED, { outOfAxisFeeAr: fee })).toEqual({
      kind: "invalid",
      errors: { outOfAxisFeeAr: "invalid" },
    });
  });

  it.each([
    ["zero", "0"],
    ["above the most pieces of an order", String(MAX_FREE_DELIVERY_MIN_PIECES + 1)],
  ])("refuses a threshold of %s", (_case, threshold) => {
    expect(planSettingsPatch(SAVED, { freeDeliveryMinPieces: threshold })).toEqual({
      kind: "invalid",
      errors: { freeDeliveryMinPieces: "invalid" },
    });
  });

  it("refuses a message made of spaces only", () => {
    expect(planSettingsPatch(SAVED, { outOfAxisMessage: "   " })).toEqual({
      kind: "invalid",
      errors: { outOfAxisMessage: "empty" },
    });
  });

  it("refuses a message longer than 200 characters", () => {
    expect(planSettingsPatch(SAVED, { outOfAxisMessage: "a".repeat(201) })).toEqual({
      kind: "invalid",
      errors: { outOfAxisMessage: "tooLong" },
    });
  });
});
