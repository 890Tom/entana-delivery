import { z } from "zod";
import { phoneInputSchema } from "../request/create-order-request.js";

/** A typed code is 6 characters plus a few separators; beyond this it cannot be a code. */
const MAX_ORDER_CODE_INPUT_LENGTH = 32;

/**
 * The body of the order lookup by phone number and order code. Strict. Both fields are checked
 * for shape and length only: the API produces the canonical phone number (`parsePhoneNumber`) and
 * the canonical code (`normalizeOrderCode`), so that a value that is not a real phone number is a
 * 400 and a value that is not a real code is the same answer as an unknown one. The phone number
 * is personal data: never log a parsed request.
 */
export const trackingLookupRequestSchema = z.strictObject({
  phone: phoneInputSchema,
  orderCode: z
    .string()
    .min(1, "is required")
    .max(MAX_ORDER_CODE_INPUT_LENGTH, { abort: true, error: "is too long" }),
});

export type TrackingLookupRequest = z.infer<typeof trackingLookupRequestSchema>;
