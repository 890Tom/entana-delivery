/**
 * An active product has no photo, which ck_product_photo_when_active forbids. The message is
 * fixed and holds no row data: the error can reach a log.
 */
export class IncompleteActiveProductError extends Error {
  constructor() {
    super("An active product has no complete photo.");
    this.name = "IncompleteActiveProductError";
  }
}
