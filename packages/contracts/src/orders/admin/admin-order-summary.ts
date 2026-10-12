import { z } from "zod";
import { orderCodeSchema } from "../code/order-code.js";

export const adminOrderSummaryQuerySchema = z.strictObject({
  /** The id of the newest order the screen has seen: only later orders are counted as new. */
  since: z.uuid().optional(),
});

export type AdminOrderSummaryQuery = z.infer<typeof adminOrderSummaryQuerySchema>;

export const adminOrderSummaryResponseSchema = z.strictObject({
  /** Orders waiting for an answer (status NEW). */
  toProcessCount: z.number().int().nonnegative(),
  /** Orders received today in the instance time zone, whatever their status. */
  todayCount: z.number().int().nonnegative(),
  /** Present only when `since` was given: the orders NEW that came after it. */
  newSince: z
    .strictObject({
      count: z.number().int().nonnegative(),
      latest: z
        .strictObject({ id: z.uuid(), publicCode: orderCodeSchema, customerName: z.string() })
        .nullable(),
    })
    .optional(),
});

export type AdminOrderSummaryResponse = z.infer<typeof adminOrderSummaryResponseSchema>;
