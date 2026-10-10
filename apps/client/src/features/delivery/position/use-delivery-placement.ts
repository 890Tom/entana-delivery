import { useRef, useState } from "react";

import { useDeliveryDraft } from "../delivery-draft/delivery-draft-context";
import type { GeoPoint } from "../map/map-adapter";
import { locate } from "./locate";
import type { LocateFailure } from "./locate";
import { toDeliveryPoint } from "../rules/to-delivery-point";

export interface DeliveryPlacement {
  readonly point: GeoPoint | null;
  /** How many points were placed: the announcement is derived from it. */
  readonly placementCount: number;
  /** A point to bring into view: a new object each time the map must move there. */
  readonly centreOn: GeoPoint | null;
  readonly positionFailure: LocateFailure | null;
  readonly isLocating: boolean;
  /**
   * The user places or moves the point by hand: kept if within the bounds of the contract,
   * ignored otherwise. It also cancels a position still awaited (the last action wins).
   */
  readonly place: (candidate: GeoPoint) => void;
  readonly askForPosition: () => void;
}

/** The state of the delivery point: placed by hand or by the device, kept in the draft. */
export function useDeliveryPlacement(): DeliveryPlacement {
  const { point, setPoint } = useDeliveryDraft();
  const [placementCount, setPlacementCount] = useState(0);
  // A point kept from earlier (a reload, another screen) is brought into view when the map is ready.
  const [centreOn, setCentreOn] = useState<GeoPoint | null>(() =>
    point === null ? null : { ...point },
  );
  const [positionFailure, setPositionFailure] = useState<LocateFailure | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  // Counts the points placed by hand, so that a position answer can tell it came too late.
  const manualPlacements = useRef(0);

  const commit = (candidate: GeoPoint): void => {
    const validated = toDeliveryPoint(candidate.lat, candidate.lng);
    if (validated === null) {
      return;
    }
    setPoint(validated);
    setPositionFailure(null);
    setPlacementCount((count) => count + 1);
  };

  const place = (candidate: GeoPoint): void => {
    manualPlacements.current += 1;
    commit(candidate);
  };

  const askForPosition = (): void => {
    const placementsAtRequest = manualPlacements.current;
    setIsLocating(true);
    void locate().then((result) => {
      setIsLocating(false);
      if (manualPlacements.current !== placementsAtRequest) {
        // The user chose a point meanwhile: their last action wins, silently.
        return;
      }
      if (result.status === "failed") {
        setPositionFailure(result.reason);
        return;
      }
      commit(result.point);
      // A new object, so that asking again for the same position moves the map again.
      setCentreOn({ ...result.point });
    });
  };

  return { point, placementCount, centreOn, positionFailure, isLocating, place, askForPosition };
}
