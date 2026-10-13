import { describe, expect, it } from "vitest";

import { buildReseller, daysAgoIso } from "../../../test-support/resellers/build-reseller";

import { countResellers, staleMonths, visibleResellers } from "./reseller-list";

const NOW = new Date();

const fresh = buildReseller(1, { name: "Épicerie Soa", neighborhood: "Analakely" });
const old = buildReseller(2, {
  name: "Kiosque Tsiry",
  neighborhood: "Ankorondrano",
  verifiedAt: daysAgoIso(125),
});
const never = buildReseller(3, { name: "Boutique Lalao", verifiedAt: null, visible: false });
const all = [fresh, old, never];

describe("the list of resellers", () => {
  it("counts the active, the inactive and the ones to verify (never verified included)", () => {
    expect(countResellers(all, NOW)).toEqual({ total: 3, active: 2, inactive: 1, stale: 2 });
  });

  it("keeps the order of the API whatever the tab", () => {
    expect(visibleResellers(all, "stale", "", NOW)).toEqual([old, never]);
    expect(visibleResellers(all, "inactive", "", NOW)).toEqual([never]);
  });

  it("searches the name and the neighborhood, without case or accent rules", () => {
    expect(visibleResellers(all, "all", "ankoro", NOW)).toEqual([old]);
    expect(visibleResellers(all, "all", "ÉPICERIE", NOW)).toEqual([fresh]);
  });
});

describe("the age of a verification", () => {
  it("counts whole months of 30 days, and none for a reseller never verified", () => {
    expect(staleMonths(old, NOW)).toBe(4);
    expect(staleMonths(never, NOW)).toBeNull();
  });
});
