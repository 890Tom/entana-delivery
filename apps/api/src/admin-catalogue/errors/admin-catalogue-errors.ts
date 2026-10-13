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

/** Only a product with a photo and its alternative text can be visible (ck_product_photo_when_active). */
export class ProductNotPublishableError extends Error {
  constructor() {
    super("The product needs a photo and its alternative text to be visible.");
    this.name = "ProductNotPublishableError";
  }
}

/** Another product already has this sku. */
export class SkuTakenError extends Error {
  constructor() {
    super("The sku is already used by another product.");
    this.name = "SkuTakenError";
  }
}

/** A photo needs its alternative text: it is sent (POST or PATCH) before the photo. */
export class PhotoAltRequiredError extends Error {
  constructor() {
    super("The product has no alternative text for its photo.");
    this.name = "PhotoAltRequiredError";
  }
}

/** The short side of the photo is under the minimum. */
export class PhotoTooSmallError extends Error {
  constructor() {
    super("The photo is too small.");
    this.name = "PhotoTooSmallError";
  }
}

/** The content is not a JPEG, a PNG or a WebP, whatever the name or the announced type say. */
export class PhotoFormatNotRecognizedError extends Error {
  constructor() {
    super("The photo is not a JPEG, PNG or WebP image.");
    this.name = "PhotoFormatNotRecognizedError";
  }
}

/** A recognised format that cannot be decoded, or that holds more pixels than allowed. */
export class PhotoCorruptError extends Error {
  constructor() {
    super("The photo cannot be read.");
    this.name = "PhotoCorruptError";
  }
}

/** The file is over the size limit of the upload. */
export class PhotoTooLargeError extends Error {
  constructor() {
    super("The photo is too large.");
    this.name = "PhotoTooLargeError";
  }
}

/** The list is not exactly the set of the products that are not retired, each once. */
export class ProductOrderMismatchError extends Error {
  constructor() {
    super("The list is not the set of the products that are not retired.");
    this.name = "ProductOrderMismatchError";
  }
}
