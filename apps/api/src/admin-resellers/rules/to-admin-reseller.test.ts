import { describe, expect, it } from "vitest";
import { toAdminReseller, toResellerState } from "./to-admin-reseller.js";
import type { StoredAdminReseller } from "./to-admin-reseller.js";
import { toResellerWrite } from "./to-reseller-write.js";

const ROW: StoredAdminReseller = {
  id: "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5f",
  name: "Demo Reseller",
  area: "Demo Area",
  landmarkText: "Next to the fake market",
  lat: -18.9,
  lng: 47.5,
  active: true,
  consentAt: new Date("2026-01-01T00:00:00.000Z"),
  verifiedAt: new Date("2026-09-01T00:00:00.000Z"),
};
const NOW = new Date("2026-10-13T08:00:00.000Z");

describe("toAdminReseller", () => {
  it("names the columns as the contract does", () => {
    expect(toAdminReseller(ROW)).toEqual({
      id: ROW.id,
      name: "Demo Reseller",
      neighborhood: "Demo Area",
      landmark: "Next to the fake market",
      latitude: -18.9,
      longitude: 47.5,
      consentGiven: true,
      visible: true,
      verifiedAt: "2026-09-01T00:00:00.000Z",
    });
  });

  it("says no consent and no verification for null dates", () => {
    const reseller = toAdminReseller({ ...ROW, consentAt: null, verifiedAt: null, active: false });

    expect(reseller).toMatchObject({ consentGiven: false, visible: false, verifiedAt: null });
  });

  it("gives the state a change reads, without the id and the verification", () => {
    expect(toResellerState(ROW)).toEqual({
      name: "Demo Reseller",
      neighborhood: "Demo Area",
      landmark: "Next to the fake market",
      latitude: -18.9,
      longitude: 47.5,
      consentGiven: true,
      visible: true,
    });
  });
});

describe("toResellerWrite", () => {
  const plan = { kind: "changed", fields: [], visibility: null } as const;

  it("dates a consent that is given now", () => {
    const write = toResellerWrite(
      { ...plan, columns: {}, consent: { from: false, to: true } },
      NOW,
    );

    expect(write.consentAt).toEqual(NOW);
  });

  it("clears the date of a consent that is withdrawn", () => {
    const write = toResellerWrite(
      { ...plan, columns: { visible: false }, consent: { from: true, to: false } },
      NOW,
    );

    expect(write).toMatchObject({ consentAt: null, active: false });
  });

  it("leaves the date of the consent alone when the consent does not change", () => {
    const write = toResellerWrite(
      { ...plan, columns: { neighborhood: "New Area" }, consent: null },
      NOW,
    );

    expect(write.consentAt).toBeUndefined();
    expect(write.area).toBe("New Area");
  });
});
