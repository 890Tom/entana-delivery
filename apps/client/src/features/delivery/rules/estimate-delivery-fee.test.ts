import { describe, expect, it } from "vitest";

import { estimateDeliveryFee } from "./estimate-delivery-fee";

describe("estimateDeliveryFee", () => {
  it("is free until the shop sets the fee when it confirms the order", () => {
    expect(estimateDeliveryFee()).toBe(0);
  });
});
