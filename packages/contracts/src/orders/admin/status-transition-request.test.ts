import { describe, expect, it } from "vitest";
import { PRODUCT_PRICE_MAX_AR } from "../../catalog/admin/product-form.js";
import {
  MAX_STATUS_REASON_LENGTH,
  statusTransitionRequestSchema,
} from "./status-transition-request.js";

const CONFIRM = { to: "CONFIRMED", deliveryDate: "2026-10-12" } as const;

describe("statusTransitionRequestSchema", () => {
  it.each([
    CONFIRM,
    { ...CONFIRM, deliveryFeeAr: 0 },
    { ...CONFIRM, deliveryFeeAr: PRODUCT_PRICE_MAX_AR },
    { to: "REJECTED" },
    { to: "REJECTED", reason: "Out of stock." },
    { to: "CANCELLED" },
    { to: "CANCELLED", reason: "Customer asked by phone." },
    { to: "OUT_FOR_DELIVERY" },
    { to: "DELIVERED" },
    { to: "FAILED" },
  ])("accepts %j", (body) => {
    expect(statusTransitionRequestSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ["a CONFIRMED without a day", { to: "CONFIRMED" }],
    ["a day that does not exist", { to: "CONFIRMED", deliveryDate: "2026-02-30" }],
    ["a day on a move that takes none", { to: "DELIVERED", deliveryDate: "2026-10-12" }],
    ["a reason on a move that takes none", { to: "FAILED", reason: "Nobody home." }],
    [
      "a reason over the limit",
      { to: "REJECTED", reason: "a".repeat(MAX_STATUS_REASON_LENGTH + 1) },
    ],
    ["a status that is not a target", { to: "NEW" }],
    ["a negative fee", { ...CONFIRM, deliveryFeeAr: -1 }],
    ["a fee that is not an integer", { ...CONFIRM, deliveryFeeAr: 1500.5 }],
    ["a fee over the limit", { ...CONFIRM, deliveryFeeAr: PRODUCT_PRICE_MAX_AR + 1 }],
    ["a fee on a move that takes none", { to: "REJECTED", deliveryFeeAr: 0 }],
  ])("refuses %s", (_label, body) => {
    expect(statusTransitionRequestSchema.safeParse(body).success).toBe(false);
  });
});
