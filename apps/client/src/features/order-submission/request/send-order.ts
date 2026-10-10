import { classifyOrderResponse } from "./classify-order-response";
import type { OrderAttempt, OrderSubmissionResult } from "../order-submission-types";

const ORDERS_ADDRESS = "/api/v1/orders";
const ORDER_TIMEOUT_MS = 15_000;

/**
 * POST the order. The request is not tied to a component: nothing here is cancelled when a
 * screen goes away, because the order may well be created on the server anyway.
 */
export async function sendOrder(attempt: OrderAttempt): Promise<OrderSubmissionResult> {
  if (!navigator.onLine) {
    return { status: "error", error: { type: "offline" } };
  }
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort();
  }, ORDER_TIMEOUT_MS);
  try {
    const response = await fetch(ORDERS_ADDRESS, {
      method: "POST",
      credentials: "omit",
      // A redirect would send the body, with its personal data, to another address.
      redirect: "error",
      headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key },
      body: JSON.stringify(attempt.request),
      signal: timeout.signal,
    });
    return await classifyOrderResponse(
      response,
      attempt.request.items.map((item) => item.productId),
    );
  } catch {
    // The text of a failure is never kept: it can hold the address, or part of the request.
    return { status: "error", error: { type: timeout.signal.aborted ? "timeout" : "network" } };
  } finally {
    clearTimeout(timer);
  }
}
