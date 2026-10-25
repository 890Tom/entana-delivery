import type { PlaceSuggestion } from "@entana/contracts";
import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "../../../components/button/button";
import { texts } from "../../../i18n/texts";
import type { GeoPoint, MapAdapter, MapZone } from "../map/map-adapter";
import { PlaceSearch } from "../place-search/place-search";

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
  /** The circles of the delivery places: none while they are not known. */
  readonly zones: readonly MapZone[];
  /**
   * A message about the map, shown once: the layout puts it under the map on a phone, and above
   * the side card from 1024 px. Nothing when there is none.
   */
  readonly notice?: ReactNode;
  /** The rest of the side column: the position button, its messages and the form. */
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

interface MapSync {
  readonly point: GeoPoint | null;
  readonly centreOn: GeoPoint | null;
  readonly zones: readonly MapZone[];
}

/** Keeps the map in step with the screen: the marker, the circles, the view where asked. */
function useMapSync(adapter: MapAdapter | null, { point, centreOn, zones }: MapSync): void {
  useEffect(() => {
    adapter?.setMarker(point);
  }, [adapter, point]);
  useEffect(() => {
    adapter?.setZones(zones);
  }, [adapter, zones]);
  useEffect(() => {
    if (adapter !== null && centreOn !== null) {
      adapter.centreOn(centreOn, RECENTRE_ZOOM);
    }
  }, [adapter, centreOn]);
}

/**
 * A chosen suggestion places the point through the same handler as a tap, then brings the map to
 * it at street level. Only offered once the map is ready.
 */
function chooseSuggestion(
  adapter: MapAdapter,
  onPick: (point: GeoPoint) => void,
): (suggestion: PlaceSuggestion) => void {
  return ({ lat, lng }) => {
    const point = { lat, lng };
    onPick(point);
    adapter.centreOn(point, RECENTRE_ZOOM);
  };
}

/**
 * The place search and the map, its fallback while it loads or fails, and the keyboard way to
 * place the point.
 */
export function PointPicker(props: PointPickerProps): ReactElement {
  const { config, isConfigFailed, onRetryConfig, onPick, notice, children } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, retry } = useMapAdapter(containerRef, config, onPick);
  const status = resolveStatus(state, config, isConfigFailed);
  const adapter = status.status === "ready" ? status.adapter : null;

  useMapSync(adapter, props);

  return (
    <div className={styles.layout}>
      <div className={styles.mapColumn}>
        <PlaceSearch
          isDisabled={adapter === null}
          onChoose={adapter === null ? () => undefined : chooseSuggestion(adapter, onPick)}
        />
        <MapFrame
          containerRef={containerRef}
          status={status.status}
          onRetry={config === undefined ? onRetryConfig : retry}
        />
      </div>
      {notice !== undefined && notice !== null && <div className={styles.notice}>{notice}</div>}
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
