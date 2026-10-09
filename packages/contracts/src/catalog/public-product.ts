import { z } from "zod";
import { mediaFileNameSchema } from "../instance/instance-config.js";

// Not `.trim()`: in Zod 4 it transforms the parsed value, and a response schema validates only.
const nonBlankString = z.string().regex(/\S/, "must contain a non-whitespace character");

const PRODUCT_IMAGE_URL_PREFIX = "/media/products/";

// A relative URL of the API's own media folder, never an absolute one: the customer app stays on one origin.
const productImageUrlSchema = z
  .string()
  .refine(
    (url) =>
      url.startsWith(PRODUCT_IMAGE_URL_PREFIX) &&
      mediaFileNameSchema.safeParse(url.slice(PRODUCT_IMAGE_URL_PREFIX.length)).success,
    "Must be a product media URL.",
  )
  .nullable();

/**
 * A product as the public catalogue shows it. It is an allow-list: the internal sku, the
 * position, the active flag and availabilityChangedAt are never part of it, and every object
 * is strict so none can be added by accident. The array order of the list is the display order.
 *
 * `image.url` is built by the API from the stored image key, which is never exposed; it is null
 * when the product has no photo file to point to. `description` may be null or an empty string;
 * whether the row-to-public mapper turns a blank description into null is decided in task P2.
 */
export const publicProductSchema = z.strictObject({
  // z.uuid() accepts versions 1 to 8: the database generates version 7, other writers version 4.
  id: z.uuid(),
  name: nonBlankString,
  description: z.string().nullable(),
  priceAr: z.number().int().positive(),
  available: z.boolean(),
  image: z.strictObject({
    url: productImageUrlSchema,
    alt: nonBlankString,
  }),
});

export type PublicProduct = z.infer<typeof publicProductSchema>;
