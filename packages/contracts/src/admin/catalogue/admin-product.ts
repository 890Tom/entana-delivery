import { z } from "zod";

/**
 * A product as the shop sees it: retired ones included, with the internal columns the public
 * catalogue never shows. `retired` is the negation of the `active` column.
 */
export const adminProductSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  sku: z.string(),
  priceAr: z.number().int().positive(),
  available: z.boolean(),
  availabilityChangedAt: z.iso.datetime(),
  retired: z.boolean(),
  description: z.string().nullable(),
  // Null until the photo is sent.
  image: z.strictObject({ url: z.string() }).nullable(),
  // Kept before the photo exists: it is sent first.
  imageAlt: z.string().nullable(),
  position: z.number().int().nonnegative(),
});

export type AdminProduct = z.infer<typeof adminProductSchema>;

/** Every product, in display order (position, then id). Not paginated: a shop-sized catalogue. */
export const adminProductListResponseSchema = z.strictObject({
  products: z.array(adminProductSchema),
});

export type AdminProductListResponse = z.infer<typeof adminProductListResponseSchema>;

export const availabilityRequestSchema = z.strictObject({ available: z.boolean() });

export type AvailabilityRequest = z.infer<typeof availabilityRequestSchema>;

/**
 * The new display order. Duplicates and a wrong set are not a malformed body: the server answers
 * them with a 409 (see `isCompleteProductOrder`), so the schema checks only the shape.
 */
export const productOrderRequestSchema = z.strictObject({ ids: z.array(z.uuid()) });

export type ProductOrderRequest = z.infer<typeof productOrderRequestSchema>;
