import { beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";

import { loadReadonlyMap } from "./maplibre-adapter";

// The library is the external boundary: it needs WebGL, which jsdom does not have.
const library = vi.hoisted(() => {
  type Handler = () => void;
  const state = {
    workerUrl: "",
    mapOptions: undefined as Record<string, unknown> | undefined,
    controls: [] as unknown[],
    handlers: {} as Record<string, Handler[]>,
    isRemoved: false,
    markerPoint: undefined as unknown,
    markerOptions: undefined as Record<string, unknown> | undefined,
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
    addControl(control: unknown): void {
      state.controls.push(control);
    }
    remove(): void {
      state.isRemoved = true;
    }
    readonly touchZoomRotate = { disableRotation: (): void => undefined };
    readonly keyboard = { disableRotation: (): void => undefined };
  }
  class FakeMarker {
    constructor(options: Record<string, unknown>) {
      state.markerOptions = options;
    }
    setLngLat(point: unknown): this {
      state.markerPoint = point;
      return this;
    }
    addTo(): this {
      return this;
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
  setWorkerUrl: (url: string) => {
    library.state.workerUrl = url;
  },
  addProtocol: (): void => undefined,
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?url", () => ({ default: "/worker.mjs" }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

const OPTIONS = {
  container: document.createElement("div"),
  styleUrl: "https://tiles.example/style",
  point: { lat: -18.9, lng: 47.5 },
  zoom: 16,
};

function fire(type: string): void {
  for (const handler of library.state.handlers[type] ?? []) {
    handler();
  }
}

beforeEach(() => {
  library.state.handlers = {};
  library.state.controls = [];
  library.state.isRemoved = false;
});

describe("loadReadonlyMap", () => {
  it("draws the style of the shop at the point, with the zoom control and the credits open", async () => {
    const loading = loadReadonlyMap(OPTIONS);
    await vi.waitFor(() => {
      expect(library.state.mapOptions).toBeDefined();
    });
    fire("load");
    await loading;

    expect(library.state.workerUrl).toBe("/worker.mjs");
    expect(library.state.mapOptions).toMatchObject({
      style: "https://tiles.example/style",
      center: [47.5, -18.9],
      zoom: 16,
      attributionControl: { compact: false },
    });
    expect(library.state.controls).toHaveLength(1);
    expect(library.state.markerPoint).toEqual([47.5, -18.9]);
    expect(library.state.mapOptions?.locale).toMatchObject({
      "NavigationControl.ZoomIn": texts.orderDetail.address.zoomIn,
    });
  });

  it("removes the map when the handle is destroyed", async () => {
    const loading = loadReadonlyMap(OPTIONS);
    await vi.waitFor(() => {
      expect(library.state.handlers.load).toBeDefined();
    });
    fire("load");
    const handle = await loading;

    handle.destroy();

    expect(library.state.isRemoved).toBe(true);
  });

  it("rejects, and removes the map, when the style fails before the first load", async () => {
    const loading = loadReadonlyMap(OPTIONS);
    await vi.waitFor(() => {
      expect(library.state.handlers.error).toBeDefined();
    });

    fire("error");

    await expect(loading).rejects.toThrow("could not be loaded");
    expect(library.state.isRemoved).toBe(true);
  });
});
