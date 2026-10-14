import type * as Library from "maplibre-gl";

// The one place that loads the map library. It is reached through dynamic imports only, so that
// the library, its style sheet and its worker stay one separate chunk that a list never loads.

export type MapLibrary = typeof Library;

/** Loads the library, its style sheet and its worker, on demand. */
export async function loadMapLibrary(): Promise<MapLibrary> {
  const [library, worker] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
    import("maplibre-gl/dist/maplibre-gl.css"),
  ]);
  // The worker is a file of the application (same origin), not a blob: a strict policy allows it.
  library.setWorkerUrl(worker.default);
  return library;
}

/** Resolves with `handle` once the style is in; a failure before that removes the map. */
export function whenMapLoaded<Handle>(map: Library.Map, handle: Handle): Promise<Handle> {
  return new Promise<Handle>((resolve, reject) => {
    let isLoaded = false;
    // An error before the first load is the style or the library failing; a tile that fails later
    // is a gap in the picture, not a reason to take the map away.
    map.on("error", () => {
      if (!isLoaded) {
        map.remove();
        reject(new Error("The map could not be loaded"));
      }
    });
    map.once("load", () => {
      isLoaded = true;
      resolve(handle);
    });
  });
}
