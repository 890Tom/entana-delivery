import { describe, expect, it } from "vitest";
import type { DeliverySettings } from "../../delivery/delivery-settings.js";
import { planDeliverySettingsUpdate } from "./plan-delivery-settings-update.js";

const BEFORE: DeliverySettings = {
  outOfAxisFeeAr: 4000,
  freeDeliveryMinPieces: 20,
  outOfAxisMessage: "Message",
};

describe("planDeliverySettingsUpdate", () => {
  it("changes one field and keeps the others", () => {
    const plan = planDeliverySettingsUpdate(BEFORE, { outOfAxisFeeAr: 5000 });

    expect(plan).toEqual({
      kind: "changed",
      columns: { outOfAxisFeeAr: 5000 },
      fields: ["outOfAxisFeeAr"],
      numbers: { outOfAxisFeeAr: { from: 4000, to: 5000 } },
    });
  });

  it("names the message without its text", () => {
    const plan = planDeliverySettingsUpdate(BEFORE, {
      outOfAxisMessage: "Autre",
      freeDeliveryMinPieces: 10,
    });

    expect(plan).toMatchObject({
      kind: "changed",
      fields: ["freeDeliveryMinPieces", "outOfAxisMessage"],
      numbers: { freeDeliveryMinPieces: { from: 20, to: 10 } },
    });
    expect(JSON.stringify(plan.kind === "changed" ? plan.numbers : null)).not.toContain("Autre");
  });

  it("is unchanged when every value sent equals the stored one", () => {
    const plan = planDeliverySettingsUpdate(BEFORE, { ...BEFORE });

    expect(plan).toEqual({ kind: "unchanged" });
  });
});
