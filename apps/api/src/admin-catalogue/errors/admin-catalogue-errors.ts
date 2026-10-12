// Typed domain errors of the administration of the catalogue. Every message is a fixed text: a
// product id, a name or a list of ids never reaches an error, a log line or a property.

/** The id is malformed or unknown: one error for both, so that no answer tells them apart. */
export class AdminProductNotFoundError extends Error {
  constructor() {
    super("No product matches this id.");
    this.name = "AdminProductNotFoundError";
  }
}

/** A retired product has no availability to change: it is restored first. */
export class ProductRetiredError extends Error {
  constructor() {
    super("The product is retired.");
    this.name = "ProductRetiredError";
  }
}

/** Only a product with a photo can be visible (ck_product_photo_when_active). */
export class ProductWithoutPhotoError extends Error {
  constructor() {
    super("The product has no photo and cannot be restored.");
    this.name = "ProductWithoutPhotoError";
  }
}

/** The list is not exactly the set of the products that are not retired, each once. */
export class ProductOrderMismatchError extends Error {
  constructor() {
    super("The list is not the set of the products that are not retired.");
    this.name = "ProductOrderMismatchError";
  }
}
