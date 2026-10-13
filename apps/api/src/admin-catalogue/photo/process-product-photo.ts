import { PRODUCT_PHOTO_MIN_SHORT_SIDE_PX } from "@entana/contracts";
import sharp from "sharp";
import {
  PhotoCorruptError,
  PhotoFormatNotRecognizedError,
  PhotoTooSmallError,
} from "../errors/admin-catalogue-errors.js";
import { encodeWithinBudget } from "./encode-within-budget.js";

const MAX_PIXELS = 40_000_000;
const MAX_SIDE = 1000;
const BUDGET_BYTES = 150_000;
const ACCEPTED_FORMATS: readonly (string | undefined)[] = ["jpeg", "png", "webp"];

interface Dimensions {
  readonly format: string | undefined;
  readonly width: number;
  readonly height: number;
}

// The header only: nothing is decoded, so a very large image costs no memory here. The format
// comes from the content, never from the name or the announced type.
async function readHeader(input: Buffer): Promise<Dimensions> {
  try {
    const { format, width, height } = await sharp(input, { limitInputPixels: false }).metadata();
    return { format, width, height };
  } catch {
    throw new PhotoFormatNotRecognizedError();
  }
}

/**
 * Turns an uploaded photo into the one file the shop keeps: a square WebP of at most 1000 px, with
 * the EXIF rotation applied, no metadata, a transparent PNG flattened on white, centred crop,
 * never enlarged, and within the weight budget when the quality allows it.
 */
export async function processProductPhoto(input: Buffer): Promise<Buffer> {
  const header = await readHeader(input);
  if (!ACCEPTED_FORMATS.includes(header.format)) {
    throw new PhotoFormatNotRecognizedError();
  }
  if (header.width * header.height > MAX_PIXELS) {
    throw new PhotoCorruptError();
  }
  // The rotation by 90 degrees swaps the sides, and the short side is the same either way.
  const shortSide = Math.min(header.width, header.height);
  if (shortSide < PRODUCT_PHOTO_MIN_SHORT_SIDE_PX) {
    throw new PhotoTooSmallError();
  }
  const side = Math.min(MAX_SIDE, shortSide);
  try {
    return await encodeWithinBudget(
      (quality) =>
        sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
          .rotate()
          .flatten({ background: "#ffffff" })
          .resize({ width: side, height: side, fit: "cover", position: "centre" })
          .webp({ quality })
          .toBuffer(),
      BUDGET_BYTES,
    );
  } catch {
    throw new PhotoCorruptError();
  }
}
