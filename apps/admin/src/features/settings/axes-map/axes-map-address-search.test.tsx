import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { chooseSuggestion } from "../../../test-support/address-search/choose-suggestion";
import { buildPlaceSuggestion } from "../../../test-support/builders/build-place-suggestion";
import { buildAxis } from "../../../test-support/settings/build-axis";
import { axesList, openAxesTab } from "../../../test-support/settings/settings-harness";
import { jsonResponse, ROUTES } from "../../../test-support/stubs/stub-api";
import type { AxesMapOptions } from "../map/axes-map-adapter";

// The map library is an external boundary that jsdom cannot run: the adapter is replaced.
const mapLoader = vi.hoisted(() => ({
  load: vi.fn(),
  setAxes: vi.fn(),
  setTestPoint: vi.fn(),
  centreOn: vi.fn(),
}));
vi.mock("../map/axes-map-adapter", () => ({ loadAxesMap: mapLoader.load }));

const SUGGESTION = buildPlaceSuggestion(1, { lat: -18.912345, lng: 47.523456 });
const POINT = { lat: -18.912345, lng: 47.523456 };

beforeEach(() => {
  mapLoader.setTestPoint.mockReset();
  mapLoader.centreOn.mockReset();
  mapLoader.load.mockReset();
  mapLoader.load.mockImplementation((_options: AxesMapOptions) =>
    Promise.resolve({
      setAxes: mapLoader.setAxes,
      setTestPoint: mapLoader.setTestPoint,
      centreOn: mapLoader.centreOn,
      destroy: () => undefined,
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the address search of the map of the axes", () => {
  it("tests the address like a click on the map and brings the map to it", async () => {
    const api = await openAxesTab(() => axesList(buildAxis(1)), {
      [ROUTES.resolve]: () => jsonResponse({ match: null, feeAr: 4000, reason: "out_of_axis" }),
    });
    expect(await screen.findByRole("combobox", { name: texts.addressSearch.label })).toBeDefined();

    await chooseSuggestion(api, SUGGESTION);

    expect(mapLoader.setTestPoint).toHaveBeenLastCalledWith(POINT);
    expect(api.addresses(ROUTES.resolve).map((address) => address.search)).toEqual([
      "?latitude=-18.912345&longitude=47.523456",
    ]);
    expect(mapLoader.centreOn).toHaveBeenCalledWith(POINT, 16);
  });
});
