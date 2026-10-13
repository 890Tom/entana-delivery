import { z } from "zod";

export const PRODUCT_NAME_MAX_LENGTH = 60;
export const PRODUCT_PRICE_MAX_AR = 1_000_000;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 120;
export const PRODUCT_IMAGE_ALT_MAX_LENGTH = 150;
/** The photo limits: the API enforces them and the answers quote them. */
export const PRODUCT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PRODUCT_PHOTO_MIN_SHORT_SIDE_PX = 800;

// The checks of a Zod 4 string run in the order they are written: normalise, then match.
const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, "Must be 2 to 20 letters, digits or dashes.");

// An empty (or blank) description clears it: the column holds null, never "".
const descriptionSchema = z
  .string()
  .trim()
  .max(PRODUCT_DESCRIPTION_MAX_LENGTH)
  .transform((value) => (value === "" ? null : value));

const fields = {
  name: z.string().trim().min(1).max(PRODUCT_NAME_MAX_LENGTH),
  priceAr: z.number().int().min(1).max(PRODUCT_PRICE_MAX_AR),
  sku: skuSchema,
  description: descriptionSchema,
  imageAlt: z.string().trim().min(1).max(PRODUCT_IMAGE_ALT_MAX_LENGTH),
  available: z.boolean(),
  retired: z.boolean(),
};

/**
 * A new product. It is always created retired (and available by default): it becomes visible only
 * after its photo is sent, with a PATCH `retired: false`. `retired` is not a field of the creation.
 */
export const createProductRequestSchema = z.strictObject({
  name: fields.name,
  priceAr: fields.priceAr,
  sku: fields.sku,
  description: fields.description.optional(),
  imageAlt: fields.imageAlt.optional(),
  available: fields.available.default(true),
});

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;

/** A partial change: at least one field. `retired: false` on a retired product restores it. */
export const updateProductRequestSchema = z
  .strictObject({
    name: fields.name.optional(),
    priceAr: fields.priceAr.optional(),
    sku: fields.sku.optional(),
    description: fields.description.optional(),
    imageAlt: fields.imageAlt.optional(),
    available: fields.available.optional(),
    retired: fields.retired.optional(),
  })
  .refine((request) => Object.keys(request).length > 0, "At least one field is required.");

export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;
