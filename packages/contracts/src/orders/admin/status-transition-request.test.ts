import { describe, expect, it } from "vitest";
import {
  MAX_STATUS_REASON_LENGTH,
  statusTransitionRequestSchema,
} from "./status-transition-request.js";

describe("statusTransitionRequestSchema", () => {
  it.each([
    { to: "CONFIRMED", deliveryDate: "2026-10-12" },
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
  ])("refuses %s", (_label, body) => {
    expect(statusTransitionRequestSchema.safeParse(body).success).toBe(false);
  });
});
