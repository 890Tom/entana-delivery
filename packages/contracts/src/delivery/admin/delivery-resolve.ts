import { z } from "zod";
import { MAX_FREE_DELIVERY_MIN_PIECES } from "./delivery-settings-request.js";
import { deliveryAxisColorSchema } from "./delivery-axis-request.js";

// A query string only holds text: a number is a plain decimal, never "1e3" or " 5".
const decimalSchema = z
  .string()
  .regex(/^-?[0-9]{1,3}(\.[0-9]{1,15})?$/)
  .transform(Number);
const piecesSchema = z
  .string()
  .regex(/^[0-9]{1,4}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(MAX_FREE_DELIVERY_MIN_PIECES));

/** The address to test: a point and, optionally, the number of pieces of the order. */
export const deliveryResolveQuerySchema = z.strictObject({
  latitude: decimalSchema.pipe(z.number().min(-90).max(90)),
  longitude: decimalSchema.pipe(z.number().min(-180).max(180)),
  pieces: piecesSchema.default(1),
});

export type DeliveryResolveQuery = z.infer<typeof deliveryResolveQuerySchema>;

export const deliveryResolveResponseSchema = z.strictObject({
  match: z
    .strictObject({
      axis: z.strictObject({ id: z.uuid(), name: z.string(), color: deliveryAxisColorSchema }),
      place: z.strictObject({ id: z.uuid(), name: z.string() }),
    })
    .nullable(),
  feeAr: z.number().int().nonnegative(),
  reason: z.enum(["axis", "quantity", "out_of_axis"]),
});

export type DeliveryResolveResponse = z.infer<typeof deliveryResolveResponseSchema>;
