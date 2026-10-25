import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadPositionMap } from "./position-map-adapter";

// The library is the external boundary: it needs WebGL, which jsdom does not have.
const library = vi.hoisted(() => {
  type Handler = (event?: { lngLat: { lat: number; lng: number } }) => void;
  const state = {
    mapOptions: undefined as Record<string, unknown> | undefined,
    mapHandlers: {} as Record<string, Handler[]>,
    markerHandlers: {} as Record<string, Handler[]>,
    markerOptions: undefined as Record<string, unknown> | undefined,
    markerPoint: undefined as unknown,
    markerCount: 0,
    controlCount: 0,
    isMarkerRemoved: false,
    isMapRemoved: false,
    easedTo: undefined as unknown,
    jumpedTo: undefined as unknown,
    markerLngLat: { lat: 0, lng: 0 },
  };
  class FakeMap {
    constructor(options: Record<string, unknown>) {
      state.mapOptions = options;
    }
    on(type: string, handler: Handler): this {
      (state.mapHandlers[type] ??= []).push(handler);
      return this;
    }
    once(type: string, handler: Handler): this {
      return this.on(type, handler);
    }
    addControl(): void {
      state.controlCount += 1;
    }
    easeTo(options: unknown): void {
      state.easedTo = options;
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
    constructor(options: Record<string, unknown>) {
      state.markerOptions = options;
      state.markerCount += 1;
    }
    setLngLat(point: unknown): this {
      state.markerPoint = point;
      return this;
    }
    addTo(): this {
      return this;
    }
    on(type: string, handler: Handler): this {
      (state.markerHandlers[type] ??= []).push(handler);
      return this;
    }
    getLngLat(): { lat: number; lng: number } {
      return state.markerLngLat;
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
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?url", () => ({ default: "/worker.mjs" }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

const CENTER = { lat: -18.91, lng: 47.52 };

function options(
  point: { lat: number; lng: number } | null,
  onPick: (point: { lat: number; lng: number }) => void,
): Parameters<typeof loadPositionMap>[0] {
  return {
    container: document.createElement("div"),
    styleUrl: "https://tiles.example/style",
    center: CENTER,
    zoom: 12,
    point,
    onPick,
  };
}

async function open(
  point: { lat: number; lng: number } | null,
  onPick: (point: { lat: number; lng: number }) => void = () => undefined,
): ReturnType<typeof loadPositionMap> {
  const loading = loadPositionMap(options(point, onPick));
  await vi.waitFor(() => {
    expect(library.state.mapHandlers.load).toBeDefined();
  });
  for (const handler of library.state.mapHandlers.load ?? []) {
    handler();
  }
  return loading;
}

beforeEach(() => {
  library.state.mapHandlers = {};
  library.state.markerHandlers = {};
  library.state.markerCount = 0;
  library.state.isMarkerRemoved = false;
  library.state.isMapRemoved = false;
  library.state.easedTo = undefined;
});

describe("loadPositionMap", () => {
  it("shows the view of the shop, without a marker, while there is no position", async () => {
    await open(null);

    expect(library.state.mapOptions).toMatchObject({
      style: "https://tiles.example/style",
      center: [47.52, -18.91],
      zoom: 12,
      attributionControl: { compact: false },
    });
    expect(library.state.controlCount).toBe(1);
    expect(library.state.markerCount).toBe(0);
  });

  it("places a draggable marker at the position the reseller has", async () => {
    await open({ lat: -18.9, lng: 47.5 });

    expect(library.state.markerPoint).toEqual([47.5, -18.9]);
    expect(library.state.markerOptions).toMatchObject({ draggable: true });
  });

  it("picks the point that is clicked, and the point where the marker is dropped", async () => {
    const onPick = vi.fn();
    await open({ lat: -18.9, lng: 47.5 }, onPick);

    library.state.mapHandlers.click?.[0]?.({ lngLat: { lat: -18.8, lng: 47.4 } });
    library.state.markerLngLat = { lat: -18.7, lng: 47.3 };
    library.state.markerHandlers.dragend?.[0]?.();

    expect(onPick).toHaveBeenNthCalledWith(1, { lat: -18.8, lng: 47.4 });
    expect(onPick).toHaveBeenNthCalledWith(2, { lat: -18.7, lng: 47.3 });
  });

  it("moves the one marker to a typed point, removes it for none, and removes the map", async () => {
    const handle = await open(null);

    handle.setPoint({ lat: -18.5, lng: 47.1 });
    handle.setPoint({ lat: -18.6, lng: 47.2 });
    expect(library.state.markerCount).toBe(1);
    expect(library.state.markerPoint).toEqual([47.2, -18.6]);
    expect(library.state.easedTo).toEqual({ center: [47.2, -18.6] });

    handle.setPoint(null);
    expect(library.state.isMarkerRemoved).toBe(true);

    handle.destroy();
    expect(library.state.isMapRemoved).toBe(true);
  });

  it("jumps to a found address at the zoom it is given", async () => {
    const handle = await open(null);

    handle.centreOn({ lat: -18.5, lng: 47.1 }, 16);

    expect(library.state.jumpedTo).toEqual({ center: [47.1, -18.5], zoom: 16 });
  });

  it("rejects, and removes the map, when the style fails before the first load", async () => {
    const loading = loadPositionMap(options(null, () => undefined));
    await vi.waitFor(() => {
      expect(library.state.mapHandlers.error).toBeDefined();
    });

    library.state.mapHandlers.error?.[0]?.();

    await expect(loading).rejects.toThrow("could not be loaded");
    expect(library.state.isMapRemoved).toBe(true);
  });
});
