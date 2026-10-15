import { z } from "zod";

/** Who is signed in: what the login and `/me` answer. No hash, no token, no role. */
export const adminProfileSchema = z.strictObject({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
});

export type AdminProfile = z.infer<typeof adminProfileSchema>;
