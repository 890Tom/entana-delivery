import { useContext, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { GeoPoint } from "../../delivery/map/map-adapter";

import { RESELLERS_MAP_LOADER_CONTEXT } from "./resellers-map-loader-context";
import type { ResellersMapAdapter, ResellersMapLoader } from "./resellers-map-adapter";

export type ResellersMapStatus =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly adapter: ResellersMapAdapter };

export interface ResellersMapConfig {
  readonly styleUrl: string;
  readonly center: GeoPoint;
  readonly zoom: number;
}

interface LoadRequest {
  readonly loadMap: ResellersMapLoader;
  readonly container: HTMLElement;
  readonly config: ResellersMapConfig;
  readonly onSelect: (id: string) => void;
  readonly onStatus: (status: ResellersMapStatus) => void;
}

/** Starts a load; the returned function cancels it and removes the map that it produced. */
function startLoad({ loadMap, container, config, onSelect, onStatus }: LoadRequest): () => void {
  let isCancelled = false;
  let loaded: ResellersMapAdapter | null = null;
  loadMap({ container, ...config, onSelect }).then(
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
export function useResellersMap(
  containerRef: RefObject<HTMLElement | null>,
  config: ResellersMapConfig | undefined,
  onSelect: (id: string) => void,
): { readonly state: ResellersMapStatus; readonly retry: () => void } {
  const loadMap = useContext(RESELLERS_MAP_LOADER_CONTEXT);
  const [state, setState] = useState<ResellersMapStatus>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The latest handler, read by the map: a new handler must not load the map again.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
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
      onSelect: (id) => {
        onSelectRef.current(id);
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
