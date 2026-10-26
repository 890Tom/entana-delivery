import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MapLibrary } from "./load-maplibre";

// The library and the tile reader are the external boundary: the map needs WebGL, which jsdom
// does not have.
const library = vi.hoisted(() => {
  const state = {
    calls: [] as string[],
    protocols: [] as { name: string; loadFn: unknown }[],
    readers: [] as { tile: () => void }[],
  };
  class FakeProtocol {
    readonly tile = (): void => undefined;
    constructor() {
      state.readers.push(this);
    }
  }
  return { state, FakeProtocol };
});

vi.mock("maplibre-gl", () => ({
  setWorkerUrl: (): void => {
    library.state.calls.push("setWorkerUrl");
  },
  addProtocol: (name: string, loadFn: unknown): void => {
    library.state.calls.push("addProtocol");
    library.state.protocols.push({ name, loadFn });
  },
}));
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?url", () => ({ default: "/assets/worker.mjs" }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("pmtiles", () => ({ Protocol: library.FakeProtocol }));

// The protocol is registered once per page: each test loads the module afresh, as a new page.
async function loadInNewPage(): Promise<() => Promise<MapLibrary>> {
  const { loadMapLibrary } = await import("./load-maplibre");
  return loadMapLibrary;
}

beforeEach(() => {
  const { state } = library;
  state.calls.length = 0;
  state.protocols.length = 0;
  state.readers.length = 0;
  vi.resetModules();
});

describe("loadMapLibrary", () => {
  it("registers the pmtiles reader with the library, after the worker", async () => {
    const loadMapLibrary = await loadInNewPage();

    await loadMapLibrary();

    expect(library.state.calls).toEqual(["setWorkerUrl", "addProtocol"]);
    expect(library.state.protocols).toEqual([
      { name: "pmtiles", loadFn: library.state.readers[0]?.tile },
    ]);
  });

  it("registers the protocol once when the library is loaded twice", async () => {
    const loadMapLibrary = await loadInNewPage();

    await loadMapLibrary();
    await loadMapLibrary();

    expect(library.state.protocols).toHaveLength(1);
  });
});
