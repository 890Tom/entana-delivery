import { createOrderRequestSchema, parsePhoneNumber } from "@entana/contracts";
import type { CreateOrderRequest } from "@entana/contracts";

import type { CartLine } from "../../cart/rules/cart-reducer";

import { ORDER_FIELDS } from "../order-submission-types";
import type { OrderField } from "../order-submission-types";

type OrderLocation = CreateOrderRequest["location"];

/** What the screens hold when the order is sent. All of it is personal data. */
export interface OrderDrafts {
  readonly lines: readonly CartLine[];
  readonly point: OrderLocation | null;
  /** As typed. */
  readonly landmark: string;
  readonly name: string;
  /** The national digits as the field shows them. */
  readonly phone: string;
  readonly note: string;
  /** From the instance configuration: undefined while it is not loaded. */
  readonly countryCode: string | undefined;
}

export type OrderRequestBody = Omit<CreateOrderRequest, "trackingToken">;

export type BuiltOrderRequest =
  | { readonly ok: true; readonly request: OrderRequestBody }
  | { readonly ok: false; readonly fields: readonly OrderField[] };

const bodySchema = createOrderRequestSchema.omit({ trackingToken: true });

function toCanonicalPhone(drafts: OrderDrafts): string | undefined {
  if (drafts.countryCode === undefined) {
    return undefined;
  }
  const digits = drafts.phone.replace(/[^0-9]/g, "");
  const parsed = parsePhoneNumber(`+${drafts.countryCode}${digits}`, drafts.countryCode);
  return parsed.ok ? parsed.e164 : undefined;
}

function knownFields(paths: readonly (string | number | symbol)[]): readonly OrderField[] {
  return ORDER_FIELDS.filter((field) => paths.includes(field));
}

/**
 * The body of the order, without its token, made of the cart and the drafts (never a price, a
 * total or a fee: the server computes them). A refusal names fields only, never a value.
 */
export function buildOrderRequest(drafts: OrderDrafts): BuiltOrderRequest {
  const phone = toCanonicalPhone(drafts);
  const parsed = bodySchema.safeParse({
    phone: phone ?? "",
    contactName: drafts.name,
    // An empty note is not sent: the contract wants none, or a text.
    ...(drafts.note === "" ? {} : { customerNote: drafts.note }),
    landmarkText: drafts.landmark,
    location: drafts.point ?? undefined,
    items: drafts.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
  });
  if (parsed.success && phone !== undefined) {
    return { ok: true, request: parsed.data };
  }
  const faulty = parsed.success ? [] : parsed.error.issues.map((issue) => issue.path[0] ?? "");
  return {
    ok: false,
    fields: knownFields(phone === undefined ? [...faulty, "phone"] : faulty),
  };
}
