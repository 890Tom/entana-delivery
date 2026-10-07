import { z } from "zod";

// Not `.trim()`: in Zod 4 it transforms the parsed value, and a response schema validates only.
const nonBlankString = z.string().regex(/\S/, "must contain a non-whitespace character");

/**
 * A product as the public catalogue shows it. It is an allow-list: the internal sku, the
 * position, the active flag and availabilityChangedAt are never part of it, and every object
 * is strict so none can be added by accident. The array order of the list is the display order.
 *
 * `image.key` is an opaque identifier, not a URL. `description` may be null or an empty string;
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
    key: nonBlankString,
    alt: nonBlankString,
  }),
});

export type PublicProduct = z.infer<typeof publicProductSchema>;
