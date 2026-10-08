// Typed domain errors of the order creation. Every message is a fixed text: the phone number, the
// name, the note, the landmark, the coordinates and the tracking token never reach an error, a log
// line or a property. The only data an error carries is the product ids the client itself sent.

export class InvalidPhoneError extends Error {
  constructor() {
    super("The phone number is not valid.");
    this.name = "InvalidPhoneError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was already used for a different request.");
    this.name = "IdempotencyConflictError";
  }
}

export class CustomerBlockedError extends Error {
  constructor() {
    super("This customer cannot place an order.");
    this.name = "CustomerBlockedError";
  }
}

export class OrderRateLimitedError extends Error {
  constructor() {
    super("Too many orders were created recently for this customer.");
    this.name = "OrderRateLimitedError";
  }
}

export class UnavailableProductsError extends Error {
  constructor(readonly productIds: readonly string[]) {
    super("Some products are unknown or not available.");
    this.name = "UnavailableProductsError";
  }
}

export class OrderTooLargeError extends Error {
  constructor() {
    super("The order total is too large.");
    this.name = "OrderTooLargeError";
  }
}

// Worded as a failure of the request, not of the server: it also happens when a client reuses a
// tracking token under another idempotency key, which a retry cannot fix.
export class OrderCreationFailedError extends Error {
  constructor() {
    super("Order creation failed after several attempts.");
    this.name = "OrderCreationFailedError";
  }
}
