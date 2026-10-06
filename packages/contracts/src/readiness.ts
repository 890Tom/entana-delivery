import { z } from "zod";

/**
 * Response of GET /api/v1/health/ready when the API can serve requests.
 * Readiness is public, so the body names no component (no "database", no "checks"):
 * it must not reveal what the API depends on. Strict, so none can be added by accident.
 */
export const readinessResponseSchema = z.strictObject({
  status: z.literal("ready"),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
