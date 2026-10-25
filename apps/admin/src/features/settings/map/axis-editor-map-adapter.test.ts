import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadAxisEditorMap } from "./axis-editor-map-adapter";
import type { AxisEditorMapOptions } from "./axis-editor-map-adapter";

// The library is the external boundary: it needs WebGL, which jsdom does not have.
const library = vi.hoisted(() => {
  type Handler = (event?: { lngLat: { lat: number; lng: number } }) => void;
  const state = {
    mapOptions: undefined as Record<string, unknown> | undefined,
    handlers: {} as Record<string, Handler[]>,
    layers: [] as Record<string, unknown>[],
    sourceData: [] as unknown[],
    markerPoints: [] as unknown[],
    markerElements: [] as HTMLElement[],
    removedMarkers: 0,
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
    constructor(options: { element: HTMLElement }) {
      state.markerElements.push(options.element);
    }
    setLngLat(point: unknown): this {
      state.markerPoints.push(point);
      return this;
    }
    addTo(): this {
      return this;
    }
    remove(): void {
      state.removedMarkers += 1;
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
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?url", () => ({ default: "/worker.mjs" }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

const state = library.state;
const GARE = { name: "Gare", lat: -18.9, lng: 47.5, radiusM: 500 };
const PORT = { name: "Port", lat: -18.8, lng: 47.6, radiusM: 900 };
const DRAWING = {
  color: "#123456",
  places: [GARE, PORT],
  others: [{ lat: -18.85, lng: 47.55, radiusM: 300 }],
  pending: null,
};
const PENDING = { lat: -18.7, lng: 47.7, radiusM: 650 };

function optionsWith(overrides: Partial<AxisEditorMapOptions> = {}): AxisEditorMapOptions {
  const container = document.createElement("div");
  container.style.setProperty("--map-zone-fill-opacity", "0.2");
  container.style.setProperty("--map-zone-line-width", "2px");
  container.style.setProperty("--map-place-other-color", "#9a9aa0");
  container.style.setProperty("--map-place-other-dash", "2 2");
  container.style.setProperty("--map-place-draft-fill", "#d2a84c");
  container.style.setProperty("--map-place-draft-line", "#6b4f10");
  container.style.setProperty("--map-place-draft-dash", "3 1");
  return {
    container,
    styleUrl: "https://tiles.example/style.json",
    center: { lat: -18.91, lng: 47.52 },
    zoom: 12,
    drawing: DRAWING,
    onPick: vi.fn(),
    ...overrides,
  };
}

function fire(type: string): void {
  for (const handler of state.handlers[type] ?? []) {
    handler();
  }
}

async function loaded(options: AxisEditorMapOptions): ReturnType<typeof loadAxisEditorMap> {
  const pending = loadAxisEditorMap(options);
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
    markerElements: [],
    removedMarkers: 0,
    isMapRemoved: false,
  });
});

describe("the map of the axis editor", () => {
  it("frames the places of the axis at first", async () => {
    await loaded(optionsWith());

    expect(state.mapOptions?.bounds).toEqual([47.5, -18.9, 47.6, -18.8]);
  });

  it("opens on the shop's view when the axis has no place", async () => {
    await loaded(optionsWith({ drawing: { ...DRAWING, places: [] } }));

    expect([state.mapOptions?.center, state.mapOptions?.zoom]).toEqual([[47.52, -18.91], 12]);
  });

  it("draws the other places grey and dashed, under the axis, under the point being named", async () => {
    await loaded(optionsWith());

    expect(state.layers.map((layer) => layer.paint)).toEqual([
      { "line-color": "#9a9aa0", "line-width": 2, "line-dasharray": [2, 2] },
      { "fill-color": ["get", "color"], "fill-opacity": 0.2 },
      { "line-color": ["get", "color"], "line-width": 2 },
      { "fill-color": "#d2a84c", "fill-opacity": 0.2 },
      { "line-color": "#6b4f10", "line-width": 2, "line-dasharray": [3, 1] },
    ]);
    expect(state.sourceData[1]).toMatchObject({
      features: [{ properties: { color: "#123456" } }, {}, { geometry: { type: "LineString" } }],
    });
  });

  it("numbers the places in order, with their names", async () => {
    await loaded(optionsWith());

    expect(state.markerElements.map((element) => element.textContent)).toEqual(["1Gare", "2Port"]);
    expect(state.markerPoints).toEqual([
      [47.5, -18.9],
      [47.6, -18.8],
    ]);
  });

  it("draws the axis and its markers again when it changes", async () => {
    const handle = await loaded(optionsWith());

    handle.setDrawing({ color: "#654321", places: [PORT], others: [], pending: null });

    expect(state.sourceData.slice(-3, -1)).toEqual([
      expect.objectContaining({
        features: [expect.objectContaining({ properties: { color: "#654321" } })],
      }),
      { type: "FeatureCollection", features: [] },
    ]);
    expect(state.removedMarkers).toBe(2);
    expect(state.markerElements.at(-1)?.textContent).toBe("1Port");
  });

  it("draws the point being named with the number it will take, and its circle", async () => {
    const handle = await loaded(optionsWith());

    handle.setDrawing({ ...DRAWING, pending: PENDING });

    expect(state.markerElements.at(-1)?.textContent).toBe("3");
    expect(state.markerPoints.at(-1)).toEqual([47.7, -18.7]);
    expect(state.sourceData.at(-1)).toMatchObject({
      features: [{ geometry: { type: "Polygon" } }],
    });
  });

  it("gives the point of a click to the screen", async () => {
    const onPick = vi.fn();
    await loaded(optionsWith({ onPick }));

    for (const handler of state.handlers.click ?? []) {
      handler({ lngLat: { lat: -18.95, lng: 47.45 } });
    }

    expect(onPick).toHaveBeenCalledWith({ lat: -18.95, lng: 47.45 });
  });

  it("jumps to a found address at the zoom it is given", async () => {
    const handle = await loaded(optionsWith());

    handle.centreOn({ lat: -18.5, lng: 47.1 }, 16);

    expect(state.jumpedTo).toEqual({ center: [47.1, -18.5], zoom: 16 });
  });

  it("removes the map when it is destroyed", async () => {
    const handle = await loaded(optionsWith());

    handle.destroy();

    expect(state.isMapRemoved).toBe(true);
  });
});
