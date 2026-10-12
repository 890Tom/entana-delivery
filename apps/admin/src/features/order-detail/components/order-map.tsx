import { useEffect, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

import { Notice } from "../../../components/notice/notice";
import visuallyHidden from "../../../components/visually-hidden/visually-hidden.module.css";
import { texts } from "../../../i18n/texts";
import { useInstance } from "../../instance/use-instance";
import { loadReadonlyMap } from "../map/maplibre-adapter";

import styles from "./order-map.module.css";

/** The street level of a delivery point; the zoom of the shop's configuration is a whole city. */
const DELIVERY_POINT_ZOOM = 16;

type MapStatus = "loading" | "ready" | "failed";

interface MapState {
  readonly status: MapStatus;
  readonly retry: () => void;
}

interface LoadRequest {
  readonly container: HTMLElement;
  readonly styleUrl: string;
  readonly lat: number;
  readonly lng: number;
  readonly onStatus: (status: MapStatus) => void;
}

/** Starts a load; the function it returns cancels it and removes the map that it produced. */
function startLoad({ container, styleUrl, lat, lng, onStatus }: LoadRequest): () => void {
  let isCancelled = false;
  let loaded: { destroy: () => void } | null = null;
  loadReadonlyMap({ container, styleUrl, point: { lat, lng }, zoom: DELIVERY_POINT_ZOOM }).then(
    (handle) => {
      if (isCancelled) {
        handle.destroy();
        return;
      }
      loaded = handle;
      onStatus("ready");
    },
    () => {
      if (!isCancelled) {
        onStatus("failed");
      }
    },
  );
  return () => {
    isCancelled = true;
    loaded?.destroy();
  };
}

/** Loads the map into the container, and removes it when the sheet goes away or the point moves. */
function useReadonlyMap(
  containerRef: RefObject<HTMLDivElement | null>,
  lat: number,
  lng: number,
): MapState {
  const instance = useInstance();
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const styleUrl = instance.data?.map.styleUrl;

  useEffect(() => {
    const container = containerRef.current;
    if (styleUrl === undefined || container === null) {
      return undefined;
    }
    return startLoad({ container, styleUrl, lat, lng, onStatus: setStatus });
  }, [containerRef, styleUrl, lat, lng, attempt]);

  return {
    status: instance.isError ? "failed" : status,
    retry: () => {
      setStatus("loading");
      setAttempt((current) => current + 1);
    },
  };
}

/** The delivery point on the shop's map, read-only. The library is loaded on demand. */
export function OrderMap({ lat, lng }: { lat: number; lng: number }): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const { status, retry } = useReadonlyMap(containerRef, lat, lng);
  return (
    <div
      className={styles.frame}
      role="group"
      aria-label={texts.orderDetail.address.mapLabel}
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
            {texts.orderDetail.address.mapFailed}
          </Notice>
        </div>
      )}
    </div>
  );
}
