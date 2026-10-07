import { z } from "zod";
import { publicProductSchema } from "./public-product.js";

/**
 * Response of GET /api/v1/products: the active products in display order. An empty list is
 * valid (no active product).
 */
export const productListResponseSchema = z.strictObject({
  products: z.array(publicProductSchema),
});

export type ProductListResponse = z.infer<typeof productListResponseSchema>;
