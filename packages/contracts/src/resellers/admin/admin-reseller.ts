import { z } from "zod";

/** A reseller as the shop sees it. The mapping to the columns is the API's business. */
export const adminResellerSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  neighborhood: z.string(),
  landmark: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  consentGiven: z.boolean(),
  visible: z.boolean(),
  // Null for a reseller that was never verified.
  verifiedAt: z.iso.datetime().nullable(),
});

export type AdminReseller = z.infer<typeof adminResellerSchema>;

/** Every reseller, by neighborhood, then name. Not paginated: a shop-sized list. */
export const adminResellerListResponseSchema = z.strictObject({
  resellers: z.array(adminResellerSchema),
});

export type AdminResellerListResponse = z.infer<typeof adminResellerListResponseSchema>;
