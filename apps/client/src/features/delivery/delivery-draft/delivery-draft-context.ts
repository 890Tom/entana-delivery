import { createContext, useContext } from "react";

import type { GeoPoint } from "../map/map-adapter";

/** What the customer has chosen so far, kept in memory only (nothing is stored yet). */
export interface DeliveryDraftValue {
  readonly point: GeoPoint | null;
  readonly setPoint: (point: GeoPoint) => void;
}

export const DELIVERY_DRAFT_CONTEXT = createContext<DeliveryDraftValue | null>(null);

export function useDeliveryDraft(): DeliveryDraftValue {
  const draft = useContext(DELIVERY_DRAFT_CONTEXT);
  if (draft === null) {
    throw new Error("useDeliveryDraft must be used inside a DeliveryDraftProvider");
  }
  return draft;
}
