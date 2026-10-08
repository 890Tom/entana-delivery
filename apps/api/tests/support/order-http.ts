import { randomUUID } from "node:crypto";
import type { CreateOrderRequest } from "@entana/contracts";
import { buildOrderRequest } from "./order-request.js";

export const ORDERS_PATH = "/api/v1/orders";

const FAKE_PRODUCT_ID = "00000000-0000-4000-8000-000000000001";

/** A valid body that needs no database: the product id is a fake one. */
export function buildFakeBody(overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return buildOrderRequest([{ productId: FAKE_PRODUCT_ID, quantity: 1 }], overrides);
}

export function newKey(): string {
  return randomUUID();
}

export const FIXED_429 = {
  type: "about:blank",
  title: "Too Many Requests",
  status: 429,
  detail: "Too many requests. Try again later.",
  instance: ORDERS_PATH,
} as const;

const VALIDATION_TYPE = "urn:entana:problem:validation-error";
const NOT_VALID = "The value is not valid.";
export const HEADER_POINTER = "/headers/idempotency-key";

export function validationProblem(pointers: readonly string[]): Record<string, unknown> {
  return {
    type: VALIDATION_TYPE,
    title: "Bad Request",
    status: 400,
    detail: "The request is invalid.",
    instance: ORDERS_PATH,
    errors: pointers.map((pointer) => ({ pointer, detail: NOT_VALID })),
  };
}

export function problemBody(
  status: number,
  title: string,
  detail: string,
): Record<string, unknown> {
  return { type: "about:blank", title, status, detail, instance: ORDERS_PATH };
}
