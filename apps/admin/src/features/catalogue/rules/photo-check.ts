import { PRODUCT_PHOTO_MAX_BYTES, PRODUCT_PHOTO_MIN_SHORT_SIDE_PX } from "@entana/contracts";

/** What is wrong with a photo; the words are in the texts. */
export type PhotoProblem = "invalid" | "tooLarge" | "tooSmall";

const ACCEPTED_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

/** The "accept" of the file chooser. */
export const PHOTO_ACCEPT = ACCEPTED_TYPES.join(",");

/** What the file says about itself, before it is decoded. The server checks the content. */
export function checkPhotoFile(file: { type: string; size: number }): PhotoProblem | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "invalid";
  }
  return file.size > PRODUCT_PHOTO_MAX_BYTES ? "tooLarge" : null;
}

/** A photo is not enlarged by the server: its short side must reach the minimum. */
export function checkPhotoDimensions(size: { width: number; height: number }): PhotoProblem | null {
  return Math.min(size.width, size.height) < PRODUCT_PHOTO_MIN_SHORT_SIDE_PX ? "tooSmall" : null;
}
