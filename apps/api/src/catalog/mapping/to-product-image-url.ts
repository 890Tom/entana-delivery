import { mediaFileNameSchema } from "@entana/contracts";
import { InvalidProductImageKeyError } from "../errors/invalid-product-image-key-error.js";

const PRODUCT_MEDIA_PREFIX = "/media/products/";

/**
 * The public address of a product photo: the stored key is the name of the file in the media
 * folder. The key is checked before it is placed in a URL; an invalid one is bad data, not a
 * missing file, so it is an error and never an approximate address.
 */
export function toProductImageUrl(imageKey: string | null): string | null {
  if (imageKey === null) {
    return null;
  }
  if (!mediaFileNameSchema.safeParse(imageKey).success) {
    throw new InvalidProductImageKeyError();
  }
  return `${PRODUCT_MEDIA_PREFIX}${imageKey}`;
}
