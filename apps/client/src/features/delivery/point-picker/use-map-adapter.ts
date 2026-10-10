import { useContext, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { GeoPoint, MapAdapter, MapLoader } from "../map/map-adapter";
import { MAP_LOADER_CONTEXT } from "../map/map-loader-context";

export type MapStatus =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly adapter: MapAdapter };

export interface MapConfig {
  readonly styleUrl: string;
  readonly center: GeoPoint;
  readonly zoom: number;
}

interface LoadRequest {
  readonly loadMap: MapLoader;
  readonly container: HTMLElement;
  readonly config: MapConfig;
  readonly onPick: (point: GeoPoint) => void;
  readonly onStatus: (status: MapStatus) => void;
}

/** Starts a load; the returned function cancels it and removes the map that it produced. */
function startLoad({ loadMap, container, config, onPick, onStatus }: LoadRequest): () => void {
  let isCancelled = false;
  let loaded: MapAdapter | null = null;
  loadMap({ container, ...config, onPick }).then(
    (adapter) => {
      if (isCancelled) {
        adapter.destroy();
        return;
      }
      loaded = adapter;
      onStatus({ status: "ready", adapter });
    },
    () => {
      if (!isCancelled) {
        onStatus({ status: "failed" });
      }
    },
  );
  return () => {
    isCancelled = true;
    loaded?.destroy();
  };
}

/**
 * Loads the map into the container, and removes it when the screen goes away. `retry` loads it
 * again after a failure. `config` is undefined while the instance configuration is not known.
 */
export function useMapAdapter(
  containerRef: RefObject<HTMLElement | null>,
  config: MapConfig | undefined,
  onPick: (point: GeoPoint) => void,
): { readonly state: MapStatus; readonly retry: () => void } {
  const loadMap = useContext(MAP_LOADER_CONTEXT);
  const [state, setState] = useState<MapStatus>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The latest handler, read by the map: a new handler must not load the map again.
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (config === undefined || container === null) {
      return undefined;
    }
    return startLoad({
      loadMap,
      container,
      config,
      onPick: (point) => {
        onPickRef.current(point);
      },
      onStatus: setState,
    });
  }, [attempt, config, containerRef, loadMap]);

  const retry = (): void => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  };
  return { state, retry };
}
