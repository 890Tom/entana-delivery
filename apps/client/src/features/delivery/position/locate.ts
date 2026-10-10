import type { GeoPoint } from "../map/map-adapter";
import { toDeliveryPoint } from "../rules/to-delivery-point";

export type LocateFailure = "denied" | "unavailable" | "timeout";

export type LocateResult =
  | { readonly status: "found"; readonly point: GeoPoint }
  | { readonly status: "failed"; readonly reason: LocateFailure };

// The codes of GeolocationPositionError (the class itself is not a global in every environment).
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

// A fresh position only; it gives up after 15 seconds so that the customer is not left waiting.
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

function toFailure(code: number): LocateFailure {
  if (code === PERMISSION_DENIED) {
    return "denied";
  }
  return code === TIMEOUT ? "timeout" : "unavailable";
}

/**
 * Asks the device for its position. Call it from a user action only: it triggers the browser's
 * permission prompt. The point is a personal datum: the caller keeps it in memory and nowhere else.
 */
export function locate(): Promise<LocateResult> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ status: "failed", reason: "unavailable" });
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const point = toDeliveryPoint(coords.latitude, coords.longitude);
          resolve(
            point === null
              ? { status: "failed", reason: "unavailable" }
              : { status: "found", point },
          );
        },
        ({ code }) => {
          resolve({ status: "failed", reason: toFailure(code) });
        },
        POSITION_OPTIONS,
      );
    } catch {
      // A page that may not use geolocation throws instead of calling the failure callback.
      resolve({ status: "failed", reason: "unavailable" });
    }
  });
}
