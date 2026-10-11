// Typed domain errors of the tracking routes. Every message is a fixed text: the token, the order
// code and any order data never reach an error, a log line or a property.

/**
 * The token is absent, malformed, unknown, or the order is past its retention: one error for all
 * of them, so that no answer tells them apart.
 */
export class TrackingNotFoundError extends Error {
  constructor() {
    super("No order matches this tracking token.");
    this.name = "TrackingNotFoundError";
  }
}

export class OrderNotCancellableError extends Error {
  constructor() {
    super("This order can no longer be cancelled.");
    this.name = "OrderNotCancellableError";
  }
}

/** A stored order always has a line: a sum of nothing is a data fault, answered by the generic 500. */
export class TrackedOrderWithoutItemsError extends Error {
  constructor() {
    super("The tracked order has no item.");
    this.name = "TrackedOrderWithoutItemsError";
  }
}
