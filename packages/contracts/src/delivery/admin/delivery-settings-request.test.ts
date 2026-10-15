import { describe, expect, it } from "vitest";
import { PRODUCT_PRICE_MAX_AR } from "../../catalog/admin/product-form.js";
import {
  MAX_FREE_DELIVERY_MIN_PIECES,
  updateDeliverySettingsRequestSchema,
} from "./delivery-settings-request.js";

describe("updateDeliverySettingsRequestSchema", () => {
  it("accepts one field alone and trims the message", () => {
    const parsed = updateDeliverySettingsRequestSchema.parse({ outOfAxisMessage: "  Frais.  " });

    expect(parsed).toEqual({ outOfAxisMessage: "Frais." });
  });

  it.each([
    ["an empty body", {}],
    ["an unknown field", { outOfAxisFeeAr: 0, extra: 1 }],
    ["a negative fee", { outOfAxisFeeAr: -1 }],
    ["a decimal fee", { outOfAxisFeeAr: 1.5 }],
    ["a threshold of 0", { freeDeliveryMinPieces: 0 }],
    ["an empty message", { outOfAxisMessage: "   " }],
    ["a message of 201 characters", { outOfAxisMessage: "a".repeat(201) }],
  ])("refuses %s", (_name, body) => {
    expect(updateDeliverySettingsRequestSchema.safeParse(body).success).toBe(false);
  });

  it("accepts the upper bounds and refuses one more", () => {
    const atBounds = {
      outOfAxisFeeAr: PRODUCT_PRICE_MAX_AR,
      freeDeliveryMinPieces: MAX_FREE_DELIVERY_MIN_PIECES,
    };

    expect(updateDeliverySettingsRequestSchema.safeParse(atBounds).success).toBe(true);
    expect(
      updateDeliverySettingsRequestSchema.safeParse({
        outOfAxisFeeAr: PRODUCT_PRICE_MAX_AR + 1,
      }).success,
    ).toBe(false);
    expect(
      updateDeliverySettingsRequestSchema.safeParse({
        freeDeliveryMinPieces: MAX_FREE_DELIVERY_MIN_PIECES + 1,
      }).success,
    ).toBe(false);
  });
});
