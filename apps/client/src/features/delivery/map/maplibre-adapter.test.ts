import { computeDistanceMeters } from "@entana/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";

import type { MapAdapterOptions } from "./map-adapter";
import { loadMapLibreAdapter } from "./maplibre-adapter";

// The library is the external boundary: it needs WebGL, which jsdom does not have.
const library = vi.hoisted(() => {
  type Handler = (event?: unknown) => void;
  const state = {
    workerUrl: "",
    mapOptions: undefined as Record<string, unknown> | undefined,
    controls: [] as unknown[],
    eased: [] as unknown[],
    jumped: [] as unknown[],
    isRemoved: false,
    shouldThrow: false,
    handlers: {} as Record<string, Handler[]>,
    markerOptions: [] as Record<string, unknown>[],
    markerMoves: [] as unknown[],
    markerHandlers: {} as Record<string, Handler[]>,
    markerRemovals: 0,
    sources: {} as Record<string, unknown>,
    layers: [] as Record<string, unknown>[],
    zoneData: [] as unknown[],
  };
  class FakeMap {
    constructor(options: Record<string, unknown>) {
      if (state.shouldThrow) {
        throw new Error("no WebGL");
      }
      state.mapOptions = options;
    }
    on(type: string, handler: Handler): this {
      (state.handlers[type] ??= []).push(handler);
      return this;
    }
    once(type: string, handler: Handler): this {
      return this.on(type, handler);
    }
    addControl(control: unknown): void {
      state.controls.push(control);
    }
    easeTo(options: unknown): void {
      state.eased.push(options);
    }
    jumpTo(options: unknown): void {
      state.jumped.push(options);
    }
    readonly touchZoomRotate = { disableRotation: (): void => undefined };
    readonly keyboard = { disableRotation: (): void => undefined };
    getCenter(): { lat: number; lng: number; wrap: () => { lat: number; lng: number } } {
      const center = { lat: -18.9, lng: 47.5, wrap: () => ({ lat: -18.9, lng: 47.5 }) };
      return center;
    }
    remove(): void {
      state.isRemoved = true;
    }
    addSource(id: string, source: unknown): void {
      state.sources[id] = source;
    }
    addLayer(layer: Record<string, unknown>): void {
      state.layers.push(layer);
    }
    getSource(id: string): { setData: (data: unknown) => void } | undefined {
      return id in state.sources
        ? {
            setData: (data) => {
              state.zoneData.push(data);
            },
          }
        : undefined;
    }
  }
  class FakeMarker {
    constructor(options: Record<string, unknown>) {
      state.markerOptions.push(options);
    }
    setLngLat(position: unknown): this {
      state.markerMoves.push(position);
      return this;
    }
    addTo(): this {
      return this;
    }
    on(type: string, handler: Handler): this {
      (state.markerHandlers[type] ??= []).push(handler);
      return this;
    }
    getLngLat(): { lat: number; lng: number; wrap: () => { lat: number; lng: number } } {
      return { lat: -18.95, lng: 47.55, wrap: () => ({ lat: -18.95, lng: 47.55 }) };
    }
    remove(): void {
      state.markerRemovals += 1;
    }
  }
  class FakeNavigationControl {
    constructor(readonly options: unknown) {}
  }
  return { state, FakeMap, FakeMarker, FakeNavigationControl };
});

vi.mock("maplibre-gl", () => ({
  Map: library.FakeMap,
  Marker: library.FakeMarker,
  NavigationControl: library.FakeNavigationControl,
  setWorkerUrl: (url: string) => {
    library.state.workerUrl = url;
  },
  addProtocol: (): void => undefined,
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?url", () => ({ default: "/assets/worker.mjs" }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

const { state } = library;

// jsdom has no matchMedia: the preference of the system is what a test says it is.
function stubReducedMotion(isReduced: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isReduced && query === "(prefers-reduced-motion: reduce)",
  }));
}

function buildOptions(overrides: Partial<MapAdapterOptions> = {}): MapAdapterOptions {
  return {
    container: document.createElement("div"),
    styleUrl: "https://style.example/custom",
    center: { lat: -18.8, lng: 47.4 },
    zoom: 13,
    onPick: vi.fn(),
    ...overrides,
  };
}

/** Starts the load, lets the library module resolve, and reports that the style has loaded. */
async function loadReady(options: MapAdapterOptions): ReturnType<typeof loadMapLibreAdapter> {
  const loading = loadMapLibreAdapter(options);
  await vi.waitFor(() => {
    expect(state.handlers.load).toBeDefined();
  });
  state.handlers.load?.forEach((handler) => {
    handler();
  });
  return loading;
}

beforeEach(() => {
  state.workerUrl = "";
  state.mapOptions = undefined;
  state.controls = [];
  state.eased = [];
  state.jumped = [];
  stubReducedMotion(false);
  state.isRemoved = false;
  state.shouldThrow = false;
  state.handlers = {};
  state.markerOptions = [];
  state.markerMoves = [];
  state.markerHandlers = {};
  state.markerRemovals = 0;
  state.sources = {};
  state.layers = [];
  state.zoneData = [];
});

describe("the MapLibre adapter", () => {
  it("creates the map from the style, centre and zoom it is given, in French", async () => {
    await loadReady(buildOptions());

    expect(state.mapOptions).toMatchObject({
      style: "https://style.example/custom",
      center: [47.4, -18.8],
      zoom: 13,
      attributionControl: { compact: false },
    });
    expect(state.mapOptions?.locale).toMatchObject({ "Map.Title": texts.delivery.map.canvasLabel });
    expect(state.workerUrl).toBe("/assets/worker.mjs");
  });

  it("is ready only when the map has loaded", async () => {
    const onReady = vi.fn();

    const loading = loadMapLibreAdapter(buildOptions());
    void loading.then(onReady);
    await vi.waitFor(() => {
      expect(state.handlers.load).toBeDefined();
    });
    expect(onReady).not.toHaveBeenCalled();
    state.handlers.load?.forEach((handler) => {
      handler();
    });

    await loading;
    expect(onReady).toHaveBeenCalledOnce();
  });

  it("fails when the map reports an error before it has loaded", async () => {
    const loading = loadMapLibreAdapter(buildOptions());
    await vi.waitFor(() => {
      expect(state.handlers.error).toBeDefined();
    });

    state.handlers.error?.forEach((handler) => {
      handler({ error: new Error("style") });
    });

    await expect(loading).rejects.toThrow();
    expect(state.isRemoved).toBe(true);
  });

  it("fails when the browser cannot create the map", async () => {
    state.shouldThrow = true;

    await expect(loadMapLibreAdapter(buildOptions())).rejects.toThrow();
  });

  it("gives the tapped point, latitude first", async () => {
    const options = buildOptions();
    await loadReady(options);

    state.handlers.click?.forEach((handler) => {
      handler({ lngLat: { lat: -18.91, lng: 47.52, wrap: () => ({ lat: -18.91, lng: 47.52 }) } });
    });

    expect(options.onPick).toHaveBeenCalledWith({ lat: -18.91, lng: 47.52 });
  });

  it("shows one named, draggable marker that it moves, reports and removes", async () => {
    const options = buildOptions();
    const adapter = await loadReady(options);

    adapter.setMarker({ lat: -18.9, lng: 47.5 });
    adapter.setMarker({ lat: -18.91, lng: 47.51 });

    expect(state.markerOptions).toHaveLength(1);
    expect(state.markerOptions[0]).toMatchObject({ draggable: true, anchor: "bottom" });
    const element = state.markerOptions[0]?.element;
    expect(element).toBeInstanceOf(HTMLElement);
    expect((element as HTMLElement).getAttribute("aria-label")).toBe(
      texts.delivery.map.markerLabel,
    );
    expect(state.markerMoves).toEqual([
      [47.5, -18.9],
      [47.51, -18.91],
    ]);

    state.markerHandlers.dragend?.forEach((handler) => {
      handler();
    });
    expect(options.onPick).toHaveBeenCalledWith({ lat: -18.95, lng: 47.55 });

    adapter.setMarker(null);
    expect(state.markerRemovals).toBe(1);
  });

  it("centres on a point, gives its centre and removes the map when destroyed", async () => {
    const adapter = await loadReady(buildOptions());

    adapter.centreOn({ lat: -18.9, lng: 47.5 }, 16);
    const center = adapter.getCenter();
    adapter.destroy();

    expect(state.eased).toEqual([{ center: [47.5, -18.9], zoom: 16 }]);
    expect(center).toEqual({ lat: -18.9, lng: 47.5 });
    expect(state.isRemoved).toBe(true);
  });

  it("jumps to a point, without animation, when the system asks for less motion", async () => {
    stubReducedMotion(true);
    const adapter = await loadReady(buildOptions());

    adapter.centreOn({ lat: -18.9, lng: 47.5 }, 16);

    expect(state.jumped).toEqual([{ center: [47.5, -18.9], zoom: 16 }]);
    expect(state.eased).toEqual([]);
  });

  it("draws each zone as a dashed outline of its radius in metres, in the colours of the tokens", async () => {
    const container = document.createElement("div");
    container.style.setProperty("--color-ink", "rgb(1, 2, 3)");
    container.style.setProperty("--size-map-zone-stroke", "1.5px");
    container.style.setProperty("--map-zone-dash", "6 6");
    const adapter = await loadReady(buildOptions({ container }));

    adapter.setZones([
      { center: { lat: -18.9, lng: 47.5 }, radiusM: 800 },
      { center: { lat: -18.95, lng: 47.55 }, radiusM: 500 },
    ]);

    expect(state.layers).toEqual([
      expect.objectContaining({
        type: "line",
        paint: { "line-color": "rgb(1, 2, 3)", "line-width": 1.5, "line-dasharray": [4, 4] },
      }),
    ]);
    const drawn = state.zoneData.at(-1) as {
      features: { geometry: { coordinates: number[][] } }[];
    };
    expect(drawn.features).toHaveLength(2);
    const [lng = 0, lat = 0] = drawn.features[0]?.geometry.coordinates[0] ?? [];
    expect(computeDistanceMeters({ lat: -18.9, lng: 47.5 }, { lat, lng })).toBeCloseTo(800, 3);
  });
});
