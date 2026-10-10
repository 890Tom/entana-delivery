import { createContext, useContext } from "react";

import type { GeoPoint } from "../map/map-adapter";

/**
 * What the customer has chosen so far: kept in memory, and in the session storage so that a
 * reload keeps it. Both are personal data: they never leave the device before the order.
 */
export interface DeliveryDraftValue {
  readonly point: GeoPoint | null;
  /** The text as typed, "" when there is none. Never trimmed: only the validation ignores spaces. */
  readonly landmark: string;
  readonly setPoint: (point: GeoPoint) => void;
  readonly setLandmark: (landmark: string) => void;
  /** Writes the draft to the session storage now, unless that content is already there. */
  readonly save: () => void;
  /** Empties the draft in memory and in the storage (the order was sent). */
  readonly clear: () => void;
}

export const DELIVERY_DRAFT_CONTEXT = createContext<DeliveryDraftValue | null>(null);

export function useDeliveryDraft(): DeliveryDraftValue {
  const draft = useContext(DELIVERY_DRAFT_CONTEXT);
  if (draft === null) {
    throw new Error("useDeliveryDraft must be used inside a DeliveryDraftProvider");
  }
  return draft;
}
