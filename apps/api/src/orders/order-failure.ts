import { STATUS_CODES } from "node:http";
import { GENERIC_PROBLEM_TYPE, VALIDATION_PROBLEM_TYPE } from "@entana/contracts";
import type { FieldError, ProblemDetails } from "@entana/contracts";
import {
  AddressRateLimitedError,
  CustomerBlockedError,
  IdempotencyConflictError,
  InvalidPhoneError,
  OrderRateLimitedError,
  OrderTooLargeError,
  UnavailableProductsError,
  UnsupportedContentTypeError,
} from "./order-errors.js";
import { RATE_LIMIT_RETRY_AFTER_SECONDS } from "./order-http-limits.js";

/** What the HTTP layer answers for a typed error of the order creation. */
export interface OrderFailure {
  readonly status: number;
  /** A fixed text: it never holds a value the client sent. */
  readonly detail: string;
  readonly errors?: readonly FieldError[];
  readonly productIds?: readonly string[];
  readonly headers?: Readonly<Record<string, string>>;
}

export const INVALID_VALUE_DETAIL = "The value is not valid.";
const REQUEST_INVALID_DETAIL = "The request is invalid.";
// One text for both limits: a caller must not learn which one it hit.
const TOO_MANY_REQUESTS_DETAIL = "Too many requests. Try again later.";
const UNPROCESSABLE_DETAIL = "Some products are not available.";

const PHONE_POINTER = "/phone";

function retryAfter(seconds: number): Readonly<Record<string, string>> {
  return { "Retry-After": String(seconds) };
}

const TOO_MANY_REQUESTS: OrderFailure = {
  status: 429,
  detail: TOO_MANY_REQUESTS_DETAIL,
  headers: retryAfter(RATE_LIMIT_RETRY_AFTER_SECONDS),
};

// Errors whose answer does not depend on their content.
const FIXED_FAILURES: readonly (readonly [new () => Error, OrderFailure])[] = [
  [
    InvalidPhoneError,
    {
      status: 400,
      detail: REQUEST_INVALID_DETAIL,
      errors: [{ pointer: PHONE_POINTER, detail: INVALID_VALUE_DETAIL }],
    },
  ],
  [CustomerBlockedError, { status: 403, detail: "This order cannot be placed." }],
  [
    IdempotencyConflictError,
    { status: 409, detail: "The idempotency key was already used for a different request." },
  ],
  [OrderTooLargeError, { status: 422, detail: "The order total is too large." }],
  [OrderRateLimitedError, TOO_MANY_REQUESTS],
  [AddressRateLimitedError, TOO_MANY_REQUESTS],
  [
    UnsupportedContentTypeError,
    { status: 415, detail: "The content type of the request is not supported." },
  ],
];

/**
 * The answer for each typed error of the order creation, or undefined for any other error (the
 * generic mapping then applies). Every text is fixed; the only data carried is the list of product
 * ids the client itself sent. A creation that failed after several attempts is left to the
 * generic 500, which also logs it: it says nothing about the request.
 */
export function mapOrderFailure(error: unknown): OrderFailure | undefined {
  if (error instanceof UnavailableProductsError) {
    return { status: 422, detail: UNPROCESSABLE_DETAIL, productIds: [...error.productIds] };
  }
  return FIXED_FAILURES.find(([errorClass]) => error instanceof errorClass)?.[1];
}

export function toOrderProblem(failure: OrderFailure, instance: string): ProblemDetails {
  return {
    type: failure.errors === undefined ? GENERIC_PROBLEM_TYPE : VALIDATION_PROBLEM_TYPE,
    title: STATUS_CODES[failure.status] ?? "Error",
    status: failure.status,
    detail: failure.detail,
    instance,
    ...(failure.errors === undefined ? {} : { errors: [...failure.errors] }),
    ...(failure.productIds === undefined ? {} : { productIds: [...failure.productIds] }),
  };
}
