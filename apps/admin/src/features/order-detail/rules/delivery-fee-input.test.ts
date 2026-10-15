import { PRODUCT_PRICE_MAX_AR } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { confirmRequestOf, readFeeChoice } from "./delivery-fee-input";

const CURRENT_FEE_AR = 2500;

describe("readFeeChoice", () => {
  it("keeps the fee of the order when the amount did not change", () => {
    expect(readFeeChoice(CURRENT_FEE_AR, "2500")).toEqual({ kind: "unchanged" });
  });

  it("takes a different amount as an adjustment, down to a free delivery", () => {
    expect(readFeeChoice(CURRENT_FEE_AR, "0")).toEqual({ kind: "adjusted", feeAr: 0 });
  });

  it("takes the highest amount the server accepts", () => {
    expect(readFeeChoice(CURRENT_FEE_AR, String(PRODUCT_PRICE_MAX_AR))).toEqual({
      kind: "adjusted",
      feeAr: PRODUCT_PRICE_MAX_AR,
    });
  });

  it("refuses an empty field", () => {
    expect(readFeeChoice(CURRENT_FEE_AR, "")).toEqual({ kind: "invalid" });
  });

  it("refuses an amount above the highest one", () => {
    expect(readFeeChoice(CURRENT_FEE_AR, String(PRODUCT_PRICE_MAX_AR + 1))).toEqual({
      kind: "invalid",
    });
  });
});

describe("confirmRequestOf", () => {
  it("leaves the fee out when it did not change", () => {
    expect(confirmRequestOf("2026-10-02", { kind: "unchanged" })).toEqual({
      to: "CONFIRMED",
      deliveryDate: "2026-10-02",
    });
  });

  it("sends the adjusted fee", () => {
    expect(confirmRequestOf("2026-10-02", { kind: "adjusted", feeAr: 1000 })).toEqual({
      to: "CONFIRMED",
      deliveryDate: "2026-10-02",
      deliveryFeeAr: 1000,
    });
  });
});
