import { z } from "zod";

/** Response of GET /api/v1/health: liveness only, no dependency is checked. */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
  version: z.string().min(1),
  uptimeSeconds: z.number().int().nonnegative(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
