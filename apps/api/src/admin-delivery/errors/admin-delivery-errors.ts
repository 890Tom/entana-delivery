// Typed domain errors of the administration of the delivery axes. Every message is a fixed text:
// an id, a name or a coordinate never reaches an error, a log line or a property.

/** The id is malformed or unknown: one error for both, so that no answer tells them apart. */
export class AdminDeliveryAxisNotFoundError extends Error {
  constructor() {
    super("No delivery axis matches this id.");
    this.name = "AdminDeliveryAxisNotFoundError";
  }
}

export class DeliveryAxisNameTakenError extends Error {
  constructor() {
    super("The name is already used by another delivery axis.");
    this.name = "DeliveryAxisNameTakenError";
  }
}

export class DeliveryPlaceNameTakenError extends Error {
  constructor() {
    super("The name is already used by another delivery place.");
    this.name = "DeliveryPlaceNameTakenError";
  }
}

export class DeliveryAxisLimitReachedError extends Error {
  constructor() {
    super("The maximum number of delivery axes is reached.");
    this.name = "DeliveryAxisLimitReachedError";
  }
}

export class DeliveryAxisInUseError extends Error {
  constructor() {
    super("The delivery axis is used by orders.");
    this.name = "DeliveryAxisInUseError";
  }
}

export class DeliveryAxisOrderMismatchError extends Error {
  constructor() {
    super("The list is not the set of the delivery axes.");
    this.name = "DeliveryAxisOrderMismatchError";
  }
}

/** The place does not exist, or it is inactive and the axis does not already hold it. */
export class DeliveryPlaceUnavailableError extends Error {
  constructor() {
    super("A place of the list is unknown or inactive.");
    this.name = "DeliveryPlaceUnavailableError";
  }
}
