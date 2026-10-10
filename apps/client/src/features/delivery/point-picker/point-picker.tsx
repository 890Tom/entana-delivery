import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "../../../components/button/button";
import { texts } from "../../../i18n/texts";
import type { GeoPoint, MapAdapter } from "../map/map-adapter";

import { MapFrame } from "./map-frame";
import styles from "./point-picker.module.css";
import { useMapAdapter } from "./use-map-adapter";
import type { MapConfig, MapStatus } from "./use-map-adapter";

/** Close enough to see a street; the customer can zoom further by hand. */
const RECENTRE_ZOOM = 16;

interface PointPickerProps {
  /** Undefined while the instance configuration is not known. */
  readonly config: MapConfig | undefined;
  readonly isConfigFailed: boolean;
  readonly onRetryConfig: () => void;
  readonly point: GeoPoint | null;
  /** A point to bring into view: a new object each time the map must move there. */
  readonly centreOn: GeoPoint | null;
  readonly onPick: (point: GeoPoint) => void;
  /** The rest of the side column: the position button and its messages. */
  readonly children: ReactNode;
}

function resolveStatus(
  state: MapStatus,
  config: MapConfig | undefined,
  isFailed: boolean,
): MapStatus {
  if (config !== undefined) {
    return state;
  }
  return isFailed ? { status: "failed" } : { status: "loading" };
}

/** Keeps the map in step with the draft: the marker where the point is, the view where asked. */
function useMapSync(
  adapter: MapAdapter | null,
  point: GeoPoint | null,
  centreOn: GeoPoint | null,
): void {
  useEffect(() => {
    adapter?.setMarker(point);
  }, [adapter, point]);
  useEffect(() => {
    if (adapter !== null && centreOn !== null) {
      adapter.centreOn(centreOn, RECENTRE_ZOOM);
    }
  }, [adapter, centreOn]);
}

/** The map, its fallback while it loads or fails, and the keyboard way to place the point. */
export function PointPicker({
  config,
  isConfigFailed,
  onRetryConfig,
  point,
  centreOn,
  onPick,
  children,
}: PointPickerProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, retry } = useMapAdapter(containerRef, config, onPick);
  const status = resolveStatus(state, config, isConfigFailed);
  const adapter = status.status === "ready" ? status.adapter : null;

  useMapSync(adapter, point, centreOn);

  return (
    <div className={styles.layout}>
      <MapFrame
        containerRef={containerRef}
        status={status.status}
        onRetry={config === undefined ? onRetryConfig : retry}
      />
      <div className={styles.side}>
        <Button
          icon="crosshair"
          isDisabled={adapter === null}
          onClick={() => {
            if (adapter !== null) {
              onPick(adapter.getCenter());
            }
          }}
        >
          {texts.delivery.place}
        </Button>
        {children}
      </div>
    </div>
  );
}
