/**
 * An active product holds an image key that is not a plain file name, which only a write outside
 * the application can produce. The message is fixed and never holds the key: the error can reach a log.
 */
export class InvalidProductImageKeyError extends Error {
  constructor() {
    super("A product has an image key that is not a valid file name.");
    this.name = "InvalidProductImageKeyError";
  }
}
