import { trackingTokenSchema } from "@entana/contracts";
import { TrackingNotFoundError } from "../errors/tracking-errors.js";

/**
 * The token of the header, validated with the shared schema before anything else happens. An
 * absent or malformed header is the same error as an unknown token: never a distinct 400.
 */
export function readTrackingToken(header: unknown): string {
  const parsed = trackingTokenSchema.safeParse(header);
  if (!parsed.success) {
    throw new TrackingNotFoundError();
  }
  return parsed.data;
}
