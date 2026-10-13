import { createContext } from "react";

import { loadMapLibreResellersAdapter } from "./maplibre-resellers-adapter";
import type { ResellersMapLoader } from "./resellers-map-adapter";

/** The way the map of the resellers is created: the real library by default, a fake in tests. */
export const RESELLERS_MAP_LOADER_CONTEXT = createContext<ResellersMapLoader>(
  loadMapLibreResellersAdapter,
);
