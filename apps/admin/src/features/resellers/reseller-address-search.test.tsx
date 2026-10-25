import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  addressField,
  chooseSuggestion,
} from "../../test-support/address-search/choose-suggestion";
import { buildPlaceSuggestion } from "../../test-support/builders/build-place-suggestion";
import { openAt } from "../../test-support/catalogue/catalogue-harness";
import { jsonResponse, ROUTES } from "../../test-support/stubs/stub-api";
import type { PositionMapOptions } from "./map/position-map-adapter";

// The library needs WebGL: the adapter that names it is the external boundary.
const mapLoader = vi.hoisted(() => ({ load: vi.fn(), setPoint: vi.fn(), centreOn: vi.fn() }));
vi.mock("./map/position-map-adapter", () => ({ loadPositionMap: mapLoader.load }));

const t = texts.resellers.form;
const SUGGESTION = buildPlaceSuggestion(1, { lat: -18.9097, lng: 47.5236 });

beforeEach(() => {
  mapLoader.setPoint.mockReset();
  mapLoader.centreOn.mockReset();
  mapLoader.load.mockReset();
  mapLoader.load.mockImplementation((_options: PositionMapOptions) =>
    Promise.resolve({
      setPoint: mapLoader.setPoint,
      centreOn: mapLoader.centreOn,
      destroy: vi.fn(),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the address search of the reseller position", () => {
  it("places the point like a click on the map and brings the map to it", async () => {
    const api = await openAt("/revendeurs/nouveau", t.newTitle, {
      [ROUTES.resellers]: () => jsonResponse({ resellers: [] }),
    });
    expect(addressField()).toBeDefined();

    await chooseSuggestion(api, SUGGESTION);

    expect(screen.getByLabelText<HTMLInputElement>(t.map.latitude).value).toBe("-18.9097");
    expect(screen.getByLabelText<HTMLInputElement>(t.map.longitude).value).toBe("47.5236");
    expect(mapLoader.centreOn).toHaveBeenCalledWith({ lat: -18.9097, lng: 47.5236 }, 16);
  });
});
