import type * as Library from "maplibre-gl";

// The one place that loads the map library. It is reached through dynamic imports only, so that
// the library, its style sheet, its worker and the pmtiles reader stay out of a list.

export type MapLibrary = typeof Library;

// The library keeps one handler per protocol and silently replaces it on a second call, which
// would drop the reader's cache of archives: the protocol is registered once per page.
let isPmtilesRegistered = false;

/** Loads the library, its style sheet, its worker and the pmtiles reader, on demand. */
export async function loadMapLibrary(): Promise<MapLibrary> {
  const [library, worker, , pmtiles] = await Promise.all([
    import("maplibre-gl"),
    import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
    import("maplibre-gl/dist/maplibre-gl.css"),
    import("pmtiles"),
  ]);
  // The worker is a file of the application (same origin), not a blob: a strict policy allows it.
  library.setWorkerUrl(worker.default);
  // Checked and set with no await in between: two maps loading together register it once.
  if (!isPmtilesRegistered) {
    library.addProtocol("pmtiles", new pmtiles.Protocol().tile);
    isPmtilesRegistered = true;
  }
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
