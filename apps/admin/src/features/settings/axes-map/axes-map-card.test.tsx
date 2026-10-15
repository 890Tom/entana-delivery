import type { AdminDeliveryAxisPlace, DeliveryResolveResponse } from "@entana/contracts";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../../test-support/assertions/expect-no-accessibility-violations";
import { buildInstance } from "../../../test-support/builders/build-instance";
import { buildAxis, buildAxisPlace } from "../../../test-support/settings/build-axis";
import { axesList, openAxesTab } from "../../../test-support/settings/settings-harness";
import { jsonResponse, problemResponse, ROUTES } from "../../../test-support/stubs/stub-api";
import type { AxesMapOptions } from "../map/axes-map-adapter";

// The map library is an external boundary that jsdom cannot run: the adapter is replaced, and
// the test reads what the screen gave it.
const mapLoader = vi.hoisted(() => ({
  load: vi.fn(),
  setAxes: vi.fn(),
  setTestPoint: vi.fn(),
}));
vi.mock("../map/axes-map-adapter", () => ({ loadAxesMap: mapLoader.load }));

let mapOptions: AxesMapOptions | undefined;

beforeEach(() => {
  mapOptions = undefined;
  mapLoader.setAxes.mockReset();
  mapLoader.setTestPoint.mockReset();
  mapLoader.load.mockReset();
  mapLoader.load.mockImplementation((options: AxesMapOptions) => {
    mapOptions = options;
    return Promise.resolve({
      setAxes: mapLoader.setAxes,
      setTestPoint: mapLoader.setTestPoint,
      destroy: () => undefined,
    });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const t = texts.settings.map;
const CLICKED = { lat: -18.912345, lng: 47.523456 };

const north = buildAxis(1, {
  name: "Axe Nord",
  color: "#2f6b5a",
  places: [
    buildAxisPlace(1, { radiusM: 400 }),
    buildAxisPlace(2, { active: false }),
    buildAxisPlace(3, { radiusM: 900 }),
  ],
});
const east = buildAxis(2, { name: "Axe Est", color: "#9a4a2a" });
const closed = buildAxis(3, { name: "Axe Fermé", color: "#7a2e5a", active: false });

const inside: DeliveryResolveResponse = {
  match: {
    axis: { id: north.id, name: "Axe Nord", color: "#2f6b5a" },
    place: { id: buildAxisPlace(1).id, name: "Gare" },
  },
  feeAr: 0,
  reason: "axis",
};
const outside: DeliveryResolveResponse = { match: null, feeAr: 4000, reason: "out_of_axis" };

const drawnPlace = (place: AdminDeliveryAxisPlace | undefined): object => ({
  lat: place?.latitude,
  lng: place?.longitude,
  radiusM: place?.radiusM,
});

async function loadedMap(): Promise<AxesMapOptions> {
  await waitFor(() => {
    expect(mapOptions).toBeDefined();
  });
  if (mapOptions === undefined) {
    throw new Error("the map was not loaded");
  }
  return mapOptions;
}

async function clickMap(): Promise<void> {
  const options = await loadedMap();
  act(() => {
    options.onPick(CLICKED);
  });
}

describe("the map of the axes", () => {
  it("draws the active axes only, with their active places and their radii", async () => {
    await openAxesTab(() => axesList(north, east, closed));

    const options = await loadedMap();

    expect(options.axes).toEqual([
      { id: east.id, color: "#9a4a2a", places: east.places.map(drawnPlace) },
      {
        id: north.id,
        color: "#2f6b5a",
        places: [north.places[0], north.places[2]].map(drawnPlace),
      },
    ]);
  });

  it("opens on the shop's view when there is no axis", async () => {
    const shop = buildInstance().map;
    await openAxesTab(() => axesList());

    const options = await loadedMap();

    expect(options.axes).toEqual([]);
    expect({ center: options.center, zoom: options.zoom, styleUrl: options.styleUrl }).toEqual(
      shop,
    );
  });

  it("invites to test an address before the first click", async () => {
    await openAxesTab(() => axesList(north));

    expect(await screen.findByText(t.prompt)).toBeDefined();
  });

  it("offers to retry when the map cannot be loaded", async () => {
    mapLoader.load.mockRejectedValueOnce(new Error("no map"));
    await openAxesTab(() => axesList(north));

    fireEvent.click(await screen.findByRole("button", { name: texts.common.retry }));

    await waitFor(() => {
      expect(mapLoader.load).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText(t.failed)).toBeNull();
  });

  it("has no accessibility violation", async () => {
    await openAxesTab(() => axesList(north, closed));
    await loadedMap();
    await screen.findByText("Axe Nord");

    await expectNoAccessibilityViolations(document.body);
  });
});

describe("the test of an address", () => {
  it("asks the server about the clicked point and marks it on the map", async () => {
    const api = await openAxesTab(() => axesList(north), {
      [ROUTES.resolve]: () => jsonResponse(outside),
    });

    await clickMap();

    await waitFor(() => {
      expect(api.addresses(ROUTES.resolve)).toHaveLength(1);
    });
    const query = api.addresses(ROUTES.resolve)[0]?.searchParams;
    expect([query?.get("latitude"), query?.get("longitude")]).toEqual(["-18.912345", "47.523456"]);
    expect(mapLoader.setTestPoint).toHaveBeenLastCalledWith(CLICKED);
  });

  it("names the axis and the place of a point inside an axis", async () => {
    await openAxesTab(() => axesList(north), { [ROUTES.resolve]: () => jsonResponse(inside) });

    await clickMap();

    expect(await screen.findByText("Dans Axe Nord (Gare) : livraison gratuite")).toBeDefined();
    expect(screen.queryByText(t.prompt)).toBeNull();
  });

  it("gives the fee of a point outside every axis", async () => {
    await openAxesTab(() => axesList(north), { [ROUTES.resolve]: () => jsonResponse(outside) });

    await clickMap();

    // Testing Library reads the no-break spaces of the amount as plain ones.
    expect(await screen.findByText("Hors axe : 4 000 Ar")).toBeDefined();
  });

  it("says that the test failed, with no word of the server", async () => {
    await openAxesTab(() => axesList(north), { [ROUTES.resolve]: () => problemResponse(500) });

    await clickMap();

    expect(await screen.findByText(t.testFailed)).toBeDefined();
    expect(screen.queryByText(/SECRET/)).toBeNull();
  });

  it("shows the answer of the last click when an older one arrives late", async () => {
    const answers: ((response: Response) => void)[] = [];
    await openAxesTab(() => axesList(north), {
      [ROUTES.resolve]: () =>
        new Promise<Response>((resolve) => {
          answers.push(resolve);
        }),
    });

    await clickMap();
    await clickMap();
    await waitFor(() => {
      expect(answers).toHaveLength(2);
    });
    answers[1]?.(jsonResponse(inside));
    await screen.findByText("Dans Axe Nord (Gare) : livraison gratuite");
    // The older answer arrives last; its body is read in a few turns of the event loop.
    await act(async () => {
      answers[0]?.(jsonResponse(outside));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.queryByText(/Hors axe :/)).toBeNull();
    expect(screen.getByText("Dans Axe Nord (Gare) : livraison gratuite")).toBeDefined();
  });

  it("reads the axes again when the session is refused", async () => {
    const api = await openAxesTab(() => axesList(north), {
      [ROUTES.resolve]: () => problemResponse(401),
    });

    await clickMap();

    await waitFor(() => {
      expect(api.calls(ROUTES.axes)).toHaveLength(2);
    });
  });
});
