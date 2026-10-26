import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadAxesMap } from "./axes-map-adapter";
import type { AxesMapOptions } from "./axes-map-adapter";

// The library is the external boundary: it needs WebGL, which jsdom does not have.
const library = vi.hoisted(() => {
  type Handler = (event?: { lngLat: { lat: number; lng: number } }) => void;
  const state = {
    mapOptions: undefined as Record<string, unknown> | undefined,
    handlers: {} as Record<string, Handler[]>,
    layers: [] as Record<string, unknown>[],
    sourceData: [] as unknown[],
    markerPoints: [] as unknown[],
    markerCount: 0,
    isMarkerRemoved: false,
    isMapRemoved: false,
    jumpedTo: undefined as unknown,
  };
  class FakeMap {
    constructor(options: Record<string, unknown>) {
      state.mapOptions = options;
    }
    on(type: string, handler: Handler): this {
      (state.handlers[type] ??= []).push(handler);
      return this;
    }
    once(type: string, handler: Handler): this {
      return this.on(type, handler);
    }
    addControl(): void {
      return undefined;
    }
    addSource(_id: string, source: { data: unknown }): void {
      state.sourceData.push(source.data);
    }
    addLayer(layer: Record<string, unknown>): void {
      state.layers.push(layer);
    }
    getSource(): { setData: (data: unknown) => void } {
      return {
        setData: (data) => {
          state.sourceData.push(data);
        },
      };
    }
    jumpTo(options: unknown): void {
      state.jumpedTo = options;
    }
    remove(): void {
      state.isMapRemoved = true;
    }
    readonly touchZoomRotate = { disableRotation: (): void => undefined };
    readonly keyboard = { disableRotation: (): void => undefined };
  }
  class FakeMarker {
    constructor() {
      state.markerCount += 1;
    }
    setLngLat(point: unknown): this {
      state.markerPoints.push(point);
      return this;
    }
    addTo(): this {
      return this;
    }
    remove(): void {
      state.isMarkerRemoved = true;
    }
  }
  class FakeNavigation {
    constructor(readonly options: unknown) {}
  }
  return { state, FakeMap, FakeMarker, FakeNavigation };
});

vi.mock("maplibre-gl", () => ({
  Map: library.FakeMap,
  Marker: library.FakeMarker,
  NavigationControl: library.FakeNavigation,
  setWorkerUrl: (): void => undefined,
  addProtocol: (): void => undefined,
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?url", () => ({ default: "/worker.mjs" }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

const state = library.state;
const AXIS = { id: "a", color: "#123456", places: [{ lat: -18.9, lng: 47.5, radiusM: 500 }] };

function optionsWith(overrides: Partial<AxesMapOptions> = {}): AxesMapOptions {
  const container = document.createElement("div");
  container.style.setProperty("--map-zone-fill-opacity", "0.2");
  container.style.setProperty("--map-zone-line-width", "2px");
  return {
    container,
    styleUrl: "https://tiles.example/style.json",
    center: { lat: -18.91, lng: 47.52 },
    zoom: 12,
    axes: [AXIS],
    onPick: () => undefined,
    ...overrides,
  };
}

function fire(type: string, event?: { lngLat: { lat: number; lng: number } }): void {
  for (const handler of state.handlers[type] ?? []) {
    handler(event);
  }
}

async function loaded(options: AxesMapOptions): ReturnType<typeof loadAxesMap> {
  const pending = loadAxesMap(options);
  await vi.waitFor(() => {
    expect(state.mapOptions).toBeDefined();
  });
  fire("load");
  return pending;
}

beforeEach(() => {
  Object.assign(state, {
    mapOptions: undefined,
    handlers: {},
    layers: [],
    sourceData: [],
    markerPoints: [],
    markerCount: 0,
    isMarkerRemoved: false,
    isMapRemoved: false,
  });
});

describe("the map of the axes", () => {
  it("frames the drawn places at first", async () => {
    await loaded(optionsWith());

    expect(state.mapOptions?.bounds).toEqual([47.5, -18.9, 47.5, -18.9]);
    expect(state.mapOptions?.center).toBeUndefined();
  });

  it("opens on the shop's view when no place is drawn", async () => {
    await loaded(optionsWith({ axes: [] }));

    expect([state.mapOptions?.center, state.mapOptions?.zoom]).toEqual([[47.52, -18.91], 12]);
  });

  it("draws the shapes in the colour and the widths of the design tokens", async () => {
    await loaded(optionsWith());

    expect(state.sourceData[0]).toMatchObject({
      features: [{ properties: { color: "#123456" }, geometry: { type: "Polygon" } }],
    });
    expect(state.layers.map((layer) => layer.paint)).toEqual([
      { "fill-color": ["get", "color"], "fill-opacity": 0.2 },
      { "line-color": ["get", "color"], "line-width": 2 },
      { "line-color": ["get", "color"], "line-width": 2 },
    ]);
  });

  it("draws the axes again when they change", async () => {
    const handle = await loaded(optionsWith());

    handle.setAxes([]);

    expect(state.sourceData.at(-1)).toEqual({ type: "FeatureCollection", features: [] });
  });

  it("hands over the clicked point", async () => {
    const onPick = vi.fn();
    await loaded(optionsWith({ onPick }));

    fire("click", { lngLat: { lat: -18.95, lng: 47.55 } });

    expect(onPick).toHaveBeenCalledWith({ lat: -18.95, lng: 47.55 });
  });

  it("jumps to a found address at the zoom it is given", async () => {
    const handle = await loaded(optionsWith());

    handle.centreOn({ lat: -18.5, lng: 47.1 }, 16);

    expect(state.jumpedTo).toEqual({ center: [47.1, -18.5], zoom: 16 });
  });

  it("places one marker on the tested point, moves it, and removes it", async () => {
    const handle = await loaded(optionsWith());

    handle.setTestPoint({ lat: -18.9, lng: 47.5 });
    handle.setTestPoint({ lat: -18.8, lng: 47.6 });
    expect(state.markerCount).toBe(1);
    expect(state.markerPoints.at(-1)).toEqual([47.6, -18.8]);

    handle.setTestPoint(null);
    expect(state.isMarkerRemoved).toBe(true);
  });

  it("gives up and removes the map when the style fails", async () => {
    const pending = loadAxesMap(optionsWith());
    await vi.waitFor(() => {
      expect(state.mapOptions).toBeDefined();
    });

    fire("error");

    await expect(pending).rejects.toThrow();
    expect(state.isMapRemoved).toBe(true);
  });

  it("keeps the map when a tile fails once it is shown", async () => {
    await loaded(optionsWith());

    fire("error");

    expect(state.isMapRemoved).toBe(false);
  });
});
