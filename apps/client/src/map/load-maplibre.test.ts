import { afterEach, describe, expect, it, vi } from "vitest";

import { loadMapLibrary } from "./load-maplibre";

// The library is the external boundary: it needs WebGL, which jsdom does not have.
const library = vi.hoisted(() => {
  const state = { map: Symbol("Map"), workerUrls: [] as string[] };
  const buildModule = (): { Map: symbol; setWorkerUrl: (url: string) => void } => ({
    Map: state.map,
    setWorkerUrl: (url) => {
      state.workerUrls.push(url);
    },
  });
  return { state, buildModule };
});

vi.mock("maplibre-gl", () => library.buildModule());
vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?url", () => ({ default: "/assets/worker.mjs" }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

// A test that makes the library fail replaces its mock: the working one is put back after each.
afterEach(() => {
  library.state.workerUrls.length = 0;
  vi.doMock("maplibre-gl", () => library.buildModule());
  vi.resetModules();
});

describe("loadMapLibrary", () => {
  it("resolves with the map library", async () => {
    const loaded = await loadMapLibrary();

    expect(loaded.Map).toBe(library.state.map);
  });

  it("points the library at the worker file of the application", async () => {
    await loadMapLibrary();

    expect(library.state.workerUrls).toEqual(["/assets/worker.mjs"]);
  });

  it("rejects when the library cannot be loaded", async () => {
    vi.resetModules();
    vi.doMock("maplibre-gl", () => {
      throw new Error("chunk unavailable");
    });
    const { loadMapLibrary: loadAfterFailure } = await import("./load-maplibre");

    // Vitest wraps an error thrown by a mock factory; the original one is its cause.
    await expect(loadAfterFailure()).rejects.toHaveProperty("cause.message", "chunk unavailable");
  });
});
