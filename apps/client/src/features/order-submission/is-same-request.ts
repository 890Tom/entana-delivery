import { createOrderRequestSchema } from "@entana/contracts";
import type { CreateOrderRequest } from "@entana/contracts";

import type { OrderRequestBody } from "./build-order-request";

/**
 * The order the customer would send now is the one already tried, the token aside. Both sides
 * go through the contract's schema, which gives the keys one order and knows every field: a
 * field added to the contract is compared without a change here. The stored token is put on the
 * new body, so that it is the one thing that cannot differ.
 */
export function isSameRequest(stored: CreateOrderRequest, next: OrderRequestBody): boolean {
  const candidate = createOrderRequestSchema.safeParse({
    ...next,
    trackingToken: stored.trackingToken,
  });
  const normalizedStored = createOrderRequestSchema.safeParse(stored);
  return (
    candidate.success &&
    normalizedStored.success &&
    JSON.stringify(candidate.data) === JSON.stringify(normalizedStored.data)
  );
}
