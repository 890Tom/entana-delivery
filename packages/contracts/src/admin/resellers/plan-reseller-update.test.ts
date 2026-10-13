import { describe, expect, it } from "vitest";
import { planResellerUpdate } from "./plan-reseller-update.js";
import type { ResellerState } from "./plan-reseller-update.js";

const VISIBLE: ResellerState = {
  name: "Demo Reseller",
  neighborhood: "Demo Area",
  landmark: "Next to the fake market",
  latitude: -18.9,
  longitude: 47.5,
  consentGiven: true,
  visible: true,
};
const HIDDEN: ResellerState = { ...VISIBLE, visible: false };
const WITHOUT_CONSENT: ResellerState = { ...VISIBLE, consentGiven: false, visible: false };

describe("planResellerUpdate", () => {
  it("is unchanged when every value is the current one", () => {
    const plan = planResellerUpdate(VISIBLE, { name: "Demo Reseller", visible: true });

    expect(plan).toEqual({ kind: "unchanged" });
  });

  it("lists the changed fields only, with the position as latitude and longitude", () => {
    const plan = planResellerUpdate(VISIBLE, {
      name: "New name",
      neighborhood: "Demo Area",
      latitude: -18.8,
      longitude: 47.5,
    });

    expect(plan).toMatchObject({
      kind: "changed",
      columns: { name: "New name", latitude: -18.8 },
      fields: ["name", "latitude"],
      consent: null,
      visibility: null,
    });
  });

  it("reports a consent change apart from the fields", () => {
    const plan = planResellerUpdate(WITHOUT_CONSENT, { consentGiven: true });

    expect(plan).toMatchObject({
      kind: "changed",
      fields: [],
      consent: { from: false, to: true },
      visibility: null,
    });
  });

  it("publishes a hidden reseller that has the consent", () => {
    const plan = planResellerUpdate(HIDDEN, { visible: true });

    expect(plan).toMatchObject({
      kind: "changed",
      columns: { visible: true },
      visibility: { from: false, to: true },
    });
  });

  it("hides a visible reseller", () => {
    const plan = planResellerUpdate(VISIBLE, { visible: false });

    expect(plan).toMatchObject({ kind: "changed", visibility: { from: true, to: false } });
  });

  it("gives the consent and publishes in the same change", () => {
    const plan = planResellerUpdate(WITHOUT_CONSENT, { consentGiven: true, visible: true });

    expect(plan).toMatchObject({
      kind: "changed",
      consent: { from: false, to: true },
      visibility: { from: false, to: true },
    });
  });

  it("refuses to publish a reseller without the consent", () => {
    expect(planResellerUpdate(WITHOUT_CONSENT, { visible: true })).toEqual({
      kind: "not_publishable",
    });
  });

  it("refuses to withdraw the consent of a visible reseller", () => {
    expect(planResellerUpdate(VISIBLE, { consentGiven: false })).toEqual({
      kind: "not_publishable",
    });
  });

  it("withdraws the consent when the same change hides the reseller", () => {
    const plan = planResellerUpdate(VISIBLE, { consentGiven: false, visible: false });

    expect(plan).toMatchObject({
      kind: "changed",
      consent: { from: true, to: false },
      visibility: { from: true, to: false },
    });
  });
});
