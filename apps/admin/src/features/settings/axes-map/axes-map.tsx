import { useEffect, useRef, useState } from "react";
import type { GeoPoint, PublicInstance } from "@entana/contracts";
import type { ReactElement, RefObject } from "react";

import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { useInstance } from "../../instance/use-instance";
import styles from "../../../map/position-map.module.css";
import { loadAxesMap } from "../map/axes-map-adapter";
import type { AxesMapHandle } from "../map/axes-map-adapter";
import type { DrawnAxis } from "../rules/axes-drawing";

const t = texts.settings.map;

interface AxesMapProps {
  readonly axes: readonly DrawnAxis[];
  /** The tested address, shown by a marker. */
  readonly point: GeoPoint | null;
  readonly onPick: (point: GeoPoint) => void;
}

type MapStatus = "loading" | "ready" | "failed";

interface Sinks {
  readonly handleRef: RefObject<AxesMapHandle | null>;
  readonly latest: RefObject<AxesMapProps>;
  readonly setStatus: (status: MapStatus) => void;
}

/** Starts a load; the function it returns cancels it and removes the map that it produced. */
function startLoad(container: HTMLElement, map: PublicInstance["map"], sinks: Sinks): () => void {
  const { handleRef, latest, setStatus } = sinks;
  let isCancelled = false;
  loadAxesMap({
    container,
    styleUrl: map.styleUrl,
    center: map.center,
    zoom: map.zoom,
    axes: latest.current.axes,
    onPick: (point) => {
      latest.current.onPick(point);
    },
  }).then(
    (handle) => {
      if (isCancelled) {
        handle.destroy();
        return;
      }
      handleRef.current = handle;
      // The axes may have moved, and a point may exist, while the library was loading.
      handle.setAxes(latest.current.axes);
      handle.setTestPoint(latest.current.point);
      setStatus("ready");
    },
    () => {
      if (!isCancelled) {
        setStatus("failed");
      }
    },
  );
  return () => {
    isCancelled = true;
    handleRef.current?.destroy();
    handleRef.current = null;
  };
}

/** The map is created once for a style; the axes and the marker then go through the handle. */
function useMapLoad(
  containerRef: RefObject<HTMLDivElement | null>,
  sinks: Pick<Sinks, "handleRef" | "latest">,
): { status: MapStatus; retry: () => void } {
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
    return startLoad(container, map, { handleRef, latest, setStatus });
  }, [map, attempt, containerRef, handleRef, latest]);

  return {
    status: instance.isError ? "failed" : status,
    retry: () => {
      setStatus("loading");
      setAttempt((current) => current + 1);
    },
  };
}

function useAxesMap(props: AxesMapProps): {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly status: MapStatus;
  readonly retry: () => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<AxesMapHandle | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const loaded = useMapLoad(containerRef, { handleRef, latest });
  useEffect(() => {
    handleRef.current?.setAxes(props.axes);
  }, [props.axes]);
  useEffect(() => {
    handleRef.current?.setTestPoint(props.point);
  }, [props.point]);
  return { containerRef, ...loaded };
}

/** The active axes on the shop's map; a click tests an address. The library loads on demand. */
export function AxesMap(props: AxesMapProps): ReactElement {
  const { containerRef, status, retry } = useAxesMap(props);
  return (
    <div
      className={styles.frame}
      role="group"
      aria-label={t.label}
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
            {t.failed}
          </Notice>
        </div>
      )}
    </div>
  );
}
