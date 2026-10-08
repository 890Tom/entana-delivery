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
/** The detail the order service gives to an invalid phone number (not a schema failure). */
export const INVALID_PHONE_DETAIL = "The value is not valid.";
export const HEADER_POINTER = "/headers/idempotencyKey";

/** The validation problem of the order route; each error is a pointer and its fixed detail. */
export function validationProblem(
  errors: readonly (readonly [pointer: string, detail: string])[],
): Record<string, unknown> {
  return {
    type: VALIDATION_TYPE,
    title: "Bad Request",
    status: 400,
    detail: "The request is invalid.",
    instance: ORDERS_PATH,
    errors: errors.map(([pointer, detail]) => ({ pointer, detail })),
  };
}

export function problemBody(
  status: number,
  title: string,
  detail: string,
): Record<string, unknown> {
  return { type: "about:blank", title, status, detail, instance: ORDERS_PATH };
}

/** The fixed details, written out on purpose: a changed wording or swapped codes must fail tests. */
export const DETAILS = {
  invalid_type: "This field has the wrong type.",
  too_small: "This field is too small or too short.",
  too_big: "This field is too large or too long.",
  invalid_format: "This field does not have the expected format.",
  custom: "This field is not acceptable.",
  unrecognized_keys: "This object has fields that are not allowed.",
} as const;
