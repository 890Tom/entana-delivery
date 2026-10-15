import type { DeliveryQuoteResponse } from "@entana/contracts";
import { useSyncExternalStore } from "react";

import type { GeoPoint } from "../map/map-adapter";

/** The last quote that succeeded, with what it was asked for. */
export interface RetainedQuote {
  readonly point: GeoPoint;
  readonly pieces: number;
  readonly quote: DeliveryQuoteResponse;
}

// In the module, in memory only: the next screens of the order read it without asking again, and
// a reload forgets it (the delivery screen then asks again for the point of the draft).
let retained: RetainedQuote | null = null;
const listeners = new Set<() => void>();

function publish(next: RetainedQuote | null): void {
  retained = next;
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function retainDeliveryQuote(next: RetainedQuote): void {
  publish(next);
}

/** Forgets the quote: the order was sent, or (in a test) the page was reloaded. */
export function forgetDeliveryQuote(): void {
  publish(null);
}

/**
 * The retained quote when it was made for this point and this number of pieces, else null: a
 * quote for another point, or for a cart that has changed since, says nothing of this order.
 */
export function useRetainedQuote(
  point: GeoPoint | null,
  pieces: number,
): DeliveryQuoteResponse | null {
  const current = useSyncExternalStore(subscribe, () => retained);
  if (current === null || point === null) {
    return null;
  }
  const isSameRequest =
    current.point.lat === point.lat && current.point.lng === point.lng && current.pieces === pieces;
  return isSameRequest ? current.quote : null;
}
