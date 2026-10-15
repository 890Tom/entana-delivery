import { useEffect, useRef, useState } from "react";
import type { PublicInstance } from "@entana/contracts";
import type { ReactElement, RefObject } from "react";

import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { useInstance } from "../../instance/hooks/use-instance";
import { loadPositionMap } from "../map/position-map-adapter";
import type { PositionMapHandle } from "../map/position-map-adapter";
import type { MapPoint } from "../rules/reseller-form";

import styles from "../../../map/position-map.module.css";

interface PositionMapProps {
  readonly point: MapPoint | null;
  readonly onPick: (point: MapPoint) => void;
}

type MapStatus = "loading" | "ready" | "failed";

interface LoadRequest {
  readonly container: HTMLElement;
  readonly styleUrl: string;
  readonly center: MapPoint;
  readonly zoom: number;
  readonly point: MapPoint | null;
  readonly onPick: (point: MapPoint) => void;
  readonly onReady: (handle: PositionMapHandle) => void;
  readonly onFailed: () => void;
}

/** Starts a load; the function it returns cancels it and removes the map that it produced. */
function startLoad(request: LoadRequest): () => void {
  let isCancelled = false;
  let loaded: PositionMapHandle | null = null;
  const { onReady, onFailed, ...options } = request;
  loadPositionMap(options).then(
    (handle) => {
      if (isCancelled) {
        handle.destroy();
        return;
      }
      loaded = handle;
      onReady(handle);
    },
    () => {
      if (!isCancelled) {
        onFailed();
      }
    },
  );
  return () => {
    isCancelled = true;
    loaded?.destroy();
  };
}

interface Loaded {
  readonly status: MapStatus;
  readonly retry: () => void;
}

interface Loaded {
  readonly status: MapStatus;
  readonly retry: () => void;
}

interface Sinks {
  readonly handleRef: RefObject<PositionMapHandle | null>;
  readonly latest: RefObject<PositionMapProps>;
  readonly setStatus: (status: MapStatus) => void;
}

/** The first point and the callback are read from `latest` when the map is created. */
function requestFor(container: HTMLElement, map: PublicInstance["map"], sinks: Sinks): LoadRequest {
  const { handleRef, latest, setStatus } = sinks;
  return {
    container,
    styleUrl: map.styleUrl,
    center: map.center,
    zoom: map.zoom,
    point: latest.current.point,
    onPick: (point) => {
      latest.current.onPick(point);
    },
    onReady: (handle) => {
      handleRef.current = handle;
      // The point may have been typed while the library was loading.
      handle.setPoint(latest.current.point);
      setStatus("ready");
    },
    onFailed: () => {
      setStatus("failed");
    },
  };
}

/**
 * The map is created once for a style: the point that follows the typing goes through the
 * handle, so that typing never rebuilds the map.
 */
function useMapLoad(
  containerRef: RefObject<HTMLDivElement | null>,
  sinks: Pick<Sinks, "handleRef" | "latest">,
): Loaded {
  const instance = useInstance();
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const map = instance.data?.map;
  const { handleRef, latest } = sinks;

  useEffect(() => {
    const container = containerRef.current;
    if (map === undefined || container === null) {
      return undefined;
    }
    const cancel = startLoad(requestFor(container, map, { handleRef, latest, setStatus }));
    return () => {
      handleRef.current = null;
      cancel();
    };
  }, [map, attempt, containerRef, handleRef, latest]);

  return {
    status: instance.isError ? "failed" : status,
    retry: () => {
      setStatus("loading");
      setAttempt((current) => current + 1);
    },
  };
}

function usePositionMap(props: PositionMapProps): {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly status: MapStatus;
  readonly retry: () => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<PositionMapHandle | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const loaded = useMapLoad(containerRef, { handleRef, latest });
  const lat = props.point?.lat;
  const lng = props.point?.lng;
  useEffect(() => {
    handleRef.current?.setPoint(lat === undefined || lng === undefined ? null : { lat, lng });
  }, [lat, lng]);
  return { containerRef, ...loaded };
}

/** The position of a reseller: click the map or drag the marker; the library loads on demand. */
export function PositionMap(props: PositionMapProps): ReactElement {
  const { containerRef, status, retry } = usePositionMap(props);
  return (
    <div
      className={styles.frame}
      role="group"
      aria-label={texts.resellers.form.map.label}
      aria-busy={status === "loading"}
    >
      <div ref={containerRef} className={styles.canvas} />
      {status === "loading" && (
        <div className={styles.skeleton}>
          <span className={visuallyHidden.visuallyHidden}>{texts.common.loading}</span>
        </div>
      )}
      {status === "failed" && (
        <div className={styles.fallback}>
          <Notice tone="error" action={{ label: texts.common.retry, onClick: retry }}>
            {texts.resellers.form.map.failed}
          </Notice>
        </div>
      )}
    </div>
  );
}
