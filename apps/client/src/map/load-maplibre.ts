import type * as Library from "maplibre-gl";

// The one place of the customer app that loads the map library. It is reached through dynamic
// imports only, so that the library, its style sheet and its worker are one separate chunk that
// the first page never loads.

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
