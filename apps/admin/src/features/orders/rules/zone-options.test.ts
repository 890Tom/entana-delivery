import { describe, expect, it } from "vitest";

import { buildAxis } from "../../../test-support/settings/build-axis";

import { buildZoneOptions } from "./zone-options";

describe("buildZoneOptions", () => {
  it("offers every zone, then each axis in the order given, inactive ones included, then outside", () => {
    const north = buildAxis(1);
    const south = buildAxis(2, { active: false });

    expect(buildZoneOptions([north, south])).toEqual([
      { kind: "all", value: "" },
      { kind: "axis", value: north.id, name: north.name, isActive: true },
      { kind: "axis", value: south.id, name: south.name, isActive: false },
      { kind: "none", value: "none" },
    ]);
  });

  it("keeps every zone and outside while the axes are not known", () => {
    expect(buildZoneOptions(undefined)).toEqual([
      { kind: "all", value: "" },
      { kind: "none", value: "none" },
    ]);
  });
});
