import { describe, expect, it } from "vitest";
import { deliverySettingsSchema, outOfAxisMessageSchema } from "./delivery-settings.js";

describe("outOfAxisMessageSchema", () => {
  it("removes the spaces around the message", () => {
    expect(outOfAxisMessageSchema.parse("  Frais applicables.  ")).toBe("Frais applicables.");
  });

  it("refuses a message that is empty once trimmed", () => {
    expect(outOfAxisMessageSchema.safeParse("   ").success).toBe(false);
  });

  it("accepts 200 characters and refuses 201", () => {
    expect(outOfAxisMessageSchema.safeParse("a".repeat(200)).success).toBe(true);
    expect(outOfAxisMessageSchema.safeParse("a".repeat(201)).success).toBe(false);
  });
});

describe("deliverySettingsSchema", () => {
  const valid = { outOfAxisFeeAr: 0, freeDeliveryMinPieces: 1, outOfAxisMessage: "Message" };

  it("accepts a free out-of-axis fee and a threshold of one piece", () => {
    expect(deliverySettingsSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["a negative fee", { ...valid, outOfAxisFeeAr: -1 }],
    ["a fee with decimals", { ...valid, outOfAxisFeeAr: 10.5 }],
    ["a threshold of zero", { ...valid, freeDeliveryMinPieces: 0 }],
  ])("refuses %s", (_label, input) => {
    expect(deliverySettingsSchema.safeParse(input).success).toBe(false);
  });
});
