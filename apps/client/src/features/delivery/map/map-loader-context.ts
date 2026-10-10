import { createContext } from "react";

import type { MapLoader } from "./map-adapter";
import { loadMapLibreAdapter } from "./maplibre-adapter";

/** The way a map is created: the real library by default, a fake one in tests. */
export const MAP_LOADER_CONTEXT = createContext<MapLoader>(loadMapLibreAdapter);
