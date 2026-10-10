import type { PublicProduct } from "@entana/contracts";

import { texts } from "../../../i18n/texts";
import { CART_PATH, CONTACT_PATH, DELIVERY_PATH } from "../../../routes";
import type {
  OrderField,
  OrderSubmissionError,
  PlainErrorType,
} from "../../order-submission/order-submission-types";

/** What the customer can do about an error: try again, go to a screen, or nothing. */
export type ErrorAction =
  | { readonly kind: "retry" }
  | { readonly kind: "link"; readonly href: string; readonly label: string }
  | { readonly kind: "none" };

export interface SubmissionErrorView {
  readonly message: string;
  readonly action: ErrorAction;
}

const { errors } = texts.review;
const RETRY: ErrorAction = { kind: "retry" };
const NONE: ErrorAction = { kind: "none" };

/** The words of the errors that say nothing more than their type. */
const PLAIN_ERRORS: Readonly<Record<PlainErrorType, SubmissionErrorView>> = {
  offline: { message: errors.offline, action: RETRY },
  network: { message: errors.connection, action: RETRY },
  timeout: { message: errors.connection, action: RETRY },
  rate_limited: { message: errors.rateLimited, action: RETRY },
  service_unavailable: { message: errors.serviceUnavailable, action: RETRY },
  server: { message: errors.serviceUnavailable, action: RETRY },
  unconfirmed: { message: errors.unconfirmed, action: RETRY },
  order_too_large: { message: errors.orderTooLarge, action: NONE },
  blocked: { message: errors.blocked, action: NONE },
  // No retry: the key was used for another request, and a retry would be refused again.
  conflict: { message: errors.conflict, action: NONE },
  unexpected: { message: errors.unexpected, action: RETRY },
};

/** The screen where each field of the request is edited. */
const SCREEN_OF_FIELD: Readonly<Record<OrderField, string>> = {
  phone: CONTACT_PATH,
  contactName: CONTACT_PATH,
  customerNote: CONTACT_PATH,
  landmarkText: DELIVERY_PATH,
  location: DELIVERY_PATH,
  items: CART_PATH,
};

function describeFieldError(fields: readonly OrderField[]): SubmissionErrorView {
  const [first] = fields;
  if (first === undefined) {
    return PLAIN_ERRORS.unexpected;
  }
  return {
    message: errors.toFix,
    action: { kind: "link", href: SCREEN_OF_FIELD[first], label: texts.review.delivery.edit },
  };
}

function describeUnavailableProducts(
  productIds: readonly string[],
  products: readonly PublicProduct[],
): SubmissionErrorView {
  // An id the catalogue does not know is ignored: the name is read, never invented.
  const names = productIds.flatMap((id) => {
    const product = products.find((candidate) => candidate.id === id);
    return product === undefined ? [] : [product.name];
  });
  return {
    message: errors.unavailableProducts(names),
    action: { kind: "link", href: CART_PATH, label: errors.viewCart },
  };
}

/** The message and the action for an error: from its type, its fields or its product ids only. */
export function describeSubmissionError(
  error: OrderSubmissionError,
  products: readonly PublicProduct[],
): SubmissionErrorView {
  switch (error.type) {
    case "invalid_draft":
    case "validation":
      return describeFieldError(error.fields);
    case "unavailable_products":
      return describeUnavailableProducts(error.productIds, products);
    default:
      return PLAIN_ERRORS[error.type];
  }
}
