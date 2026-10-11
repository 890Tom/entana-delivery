import { trackingTokenSchema } from "@entana/contracts";

/** The token of a tracking link (`#token`), or null when the fragment holds anything else. */
export function readTrackingToken(hash: string): string | null {
  const parsed = trackingTokenSchema.safeParse(hash.startsWith("#") ? hash.slice(1) : hash);
  return parsed.success ? parsed.data : null;
}
