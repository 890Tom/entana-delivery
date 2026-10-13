import { z } from "zod";

/**
 * A reseller as a visitor sees it. Consent, visibility and verification are internal: they are not
 * in this shape, and the strict object refuses them.
 */
export const publicResellerSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  neighborhood: z.string(),
  landmark: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export type PublicReseller = z.infer<typeof publicResellerSchema>;
