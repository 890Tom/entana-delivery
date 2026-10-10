import { createOrderResponseSchema, problemDetailsSchema } from "@entana/contracts";

import { ORDER_FIELDS } from "./order-submission-types";
import type {
  OrderField,
  OrderSubmissionError,
  OrderSubmissionResult,
  PlainErrorType,
} from "./order-submission-types";

// Only what is read from an error answer: its text and its title are never looked at.
const problemSchema = problemDetailsSchema.pick({ errors: true, productIds: true });

const ERROR_BY_STATUS: Readonly<Record<number, PlainErrorType>> = {
  403: "blocked",
  409: "conflict",
  429: "rate_limited",
  503: "service_unavailable",
};

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

const error = (value: OrderSubmissionError): OrderSubmissionResult => ({
  status: "error",
  error: value,
});

async function classifyCreated(response: Response): Promise<OrderSubmissionResult> {
  const parsed = createOrderResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    return error({ type: "unconfirmed" });
  }
  const { orderCode, totalAr, createdAt } = parsed.data;
  return { status: "confirmed", orderCode, totalAr, createdAt };
}

/** "/items/0/quantity" is about "items": the first segment, if the form knows it. */
function fieldsOf(pointers: readonly string[]): readonly OrderField[] {
  const firstSegments = pointers.map((pointer) => pointer.split("/")[1] ?? "");
  return ORDER_FIELDS.filter((field) => firstSegments.includes(field));
}

async function classifyBadRequest(response: Response): Promise<OrderSubmissionResult> {
  const parsed = problemSchema.safeParse(await readJson(response));
  const pointers = parsed.success ? (parsed.data.errors ?? []).map((item) => item.pointer) : [];
  return error({ type: "validation", fields: fieldsOf(pointers) });
}

/**
 * Both 422 answers have the same type and title: the ids of the products tell them apart (only
 * the unavailable products answer carries them), and only the ids the client sent are kept.
 */
async function classifyUnprocessable(
  response: Response,
  sentProductIds: readonly string[],
): Promise<OrderSubmissionResult> {
  const parsed = problemSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    return error({ type: "unexpected" });
  }
  if (parsed.data.productIds === undefined) {
    return error({ type: "order_too_large" });
  }
  const sent = new Set(sentProductIds.map((id) => id.toLowerCase()));
  const productIds = parsed.data.productIds.filter((id) => sent.has(id.toLowerCase()));
  return productIds.length === 0
    ? error({ type: "unexpected" })
    : error({ type: "unavailable_products", productIds });
}

/** Turns an answer into a result from its status and its known fields only. */
export function classifyOrderResponse(
  response: Response,
  sentProductIds: readonly string[],
): Promise<OrderSubmissionResult> {
  if (response.status === 201) {
    return classifyCreated(response);
  }
  if (response.ok) {
    // Any other 2xx: the order may have been created, and nothing readable says so.
    return Promise.resolve(error({ type: "unconfirmed" }));
  }
  if (response.status === 400) {
    return classifyBadRequest(response);
  }
  if (response.status === 422) {
    return classifyUnprocessable(response, sentProductIds);
  }
  const known = ERROR_BY_STATUS[response.status];
  if (known !== undefined) {
    return Promise.resolve(error({ type: known }));
  }
  return Promise.resolve(error({ type: response.status >= 500 ? "server" : "unexpected" }));
}
