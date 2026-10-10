import { createOrderRequestSchema } from "@entana/contracts";

// The rules of the text are the contract's own; only the design's minimum is added here.
const LANDMARK_SCHEMA = createOrderRequestSchema.shape.landmarkText;
const MIN_LANDMARK_LENGTH = 3;

/**
 * Whether the landmark can be sent: it passes the contract's schema and has at least three
 * characters once the spaces around it are removed. The text itself is never changed.
 */
export function isValidLandmark(text: string): boolean {
  return text.trim().length >= MIN_LANDMARK_LENGTH && LANDMARK_SCHEMA.safeParse(text).success;
}
