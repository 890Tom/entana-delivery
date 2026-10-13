import { z } from "zod";
import { publicResellerSchema } from "./public-reseller.js";

/**
 * Response of GET /api/v1/resellers: the visible resellers, by neighborhood, then name. An empty
 * list is valid. Not paginated: a shop-sized list.
 */
export const resellerListResponseSchema = z.strictObject({
  resellers: z.array(publicResellerSchema),
});

export type ResellerListResponse = z.infer<typeof resellerListResponseSchema>;
