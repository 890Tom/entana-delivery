// Typed domain errors of the administration of orders. Every message is a fixed text: an order id,
// a status or a reason never reaches an error, a log line or a property.

/** The id is malformed or unknown: one error for both, so that no answer tells them apart. */
export class AdminOrderNotFoundError extends Error {
  constructor() {
    super("No order matches this id.");
    this.name = "AdminOrderNotFoundError";
  }
}

/**
 * The move is not in the table of the shop, the order already has the requested status, or its
 * status changed in between (a customer's cancellation included): one error for the three.
 */
export class OrderTransitionRefusedError extends Error {
  constructor() {
    super("The order cannot move to this status.");
    this.name = "OrderTransitionRefusedError";
  }
}
