import { useState } from "react";

import type { GeoPoint } from "../delivery/map/map-adapter";
import { locate } from "../delivery/position/locate";
import type { LocateFailure } from "../delivery/position/locate";

type NearbyRequest =
  | { readonly status: "idle" }
  | { readonly status: "locating" }
  | { readonly status: "failed"; readonly reason: LocateFailure };

export interface NearbyPosition {
  /** The position of the device, kept in this state only: never sent, stored or written. */
  readonly point: GeoPoint | null;
  readonly request: NearbyRequest;
  /** Asks the device once. Call it from a user action only: it opens the browser's prompt. */
  readonly ask: () => void;
}

/**
 * The position behind "Autour de moi". It is asked for when `ask` is called, once per call (no
 * watch). A failure keeps the position found earlier, if any.
 */
export function useNearbyPosition(): NearbyPosition {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [request, setRequest] = useState<NearbyRequest>({ status: "idle" });

  const ask = (): void => {
    if (request.status === "locating") {
      return;
    }
    setRequest({ status: "locating" });
    void locate().then((result) => {
      if (result.status === "found") {
        setPoint(result.point);
        setRequest({ status: "idle" });
        return;
      }
      setRequest({ status: "failed", reason: result.reason });
    });
  };
  return { point, request, ask };
}
