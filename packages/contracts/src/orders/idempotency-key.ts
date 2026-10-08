import { z } from "zod";

/**
 * The value of the `Idempotency-Key` header of an order creation. A uuid of any version
 * (z.uuid() accepts versions 1 to 8). The database column is a text, so any uuid fits.
 */
export const idempotencyKeySchema = z.uuid();

export type IdempotencyKey = z.infer<typeof idempotencyKeySchema>;
