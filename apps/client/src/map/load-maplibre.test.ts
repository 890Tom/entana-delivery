import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MapLibrary } from "./load-maplibre";

// The library and the tile reader are the external boundary: the map needs WebGL, which jsdom
// does not have.
const library = vi.hoisted(() => {
  const state = {
    map: Symbol("Map"),
    calls: [] as string[],
    workerUrls: [] as string[],
    protocols: [] as { name: string; loadFn: unknown }[],
    readers: [] as { tile: () => void }[],
  };
  const buildModule = (): {
    Map: symbol;
    setWorkerUrl: (url: string) => void;
    addProtocol: (name: string, loadFn: unknown) => void;
  } => ({
    Map: state.map,
    setWorkerUrl: (url) => {
      state.calls.push("setWorkerUrl");
      state.workerUrls.push(url);
    },
    addProtocol: (name, loadFn) => {
      state.calls.push("addProtocol");
      state.protocols.push({ name, loadFn });
    },
  });
  class FakeProtocol {
    readonly tile = (): void => undefined;
    constructor() {
      state.readers.push(this);
    }
  }
  return { state, buildModule, FakeProtocol };
});

vi.mock("maplibre-gl", () => library.buildModule());
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
  state.workerUrls.length = 0;
  state.protocols.length = 0;
  state.readers.length = 0;
  // A test that makes the library fail replaces its mock: the working one is put back.
  vi.doMock("maplibre-gl", () => library.buildModule());
  vi.resetModules();
});

describe("loadMapLibrary", () => {
  it("resolves with the map library", async () => {
    const loadMapLibrary = await loadInNewPage();

    const loaded = await loadMapLibrary();

    expect(loaded.Map).toBe(library.state.map);
  });

  it("points the library at the worker file of the application", async () => {
    const loadMapLibrary = await loadInNewPage();

    await loadMapLibrary();

    expect(library.state.workerUrls).toEqual(["/assets/worker.mjs"]);
  });

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

  it("rejects when the library cannot be loaded", async () => {
    vi.doMock("maplibre-gl", () => {
      throw new Error("chunk unavailable");
    });
    const loadMapLibrary = await loadInNewPage();

    // Vitest wraps an error thrown by a mock factory; the original one is its cause.
    await expect(loadMapLibrary()).rejects.toHaveProperty("cause.message", "chunk unavailable");
  });
});
