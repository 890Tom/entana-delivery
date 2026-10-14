import type { PrismaClient } from "@entana/database";
import type { CreateOrderRequest } from "@entana/contracts";
import { hashTrackingToken } from "../rules/hash-tracking-token.js";
import type { StoredOrder } from "../rules/matches-stored-order.js";
import { STORED_ORDER_SELECT } from "./order-queries.js";
import type { OrderLine } from "../rules/resolve-order-lines.js";
import { toFeeReason } from "../rules/to-fee-reason.js";
import type { DeliveryQuote } from "../../delivery-quote/delivery-quote.service.js";

export interface NewOrder {
  readonly request: CreateOrderRequest;
  readonly idempotencyKey: string;
  readonly customerId: string;
  readonly orderCode: string;
  readonly lines: readonly OrderLine[];
  readonly fee: DeliveryQuote;
  readonly totalAr: number;
  readonly createdAt: Date;
}

function toItemRows(lines: readonly OrderLine[]): {
  readonly productId: string;
  readonly productName: string;
  readonly qty: number;
  readonly unitPrice: number;
}[] {
  return lines.map((line) => ({
    productId: line.productId,
    productName: line.productName,
    qty: line.quantity,
    unitPrice: line.unitPrice,
  }));
}

/**
 * Inserts the order, its items and its creation event in the caller's transaction. The event
 * mirrors the seed: STATUS_CHANGED, from null to NEW, by the customer, with an empty payload (no
 * customer data in an event).
 */
export function insertOrder(
  database: Pick<PrismaClient, "customerOrder">,
  order: NewOrder,
): Promise<StoredOrder> {
  const { request } = order;
  return database.customerOrder.create({
    data: {
      publicTokenHash: hashTrackingToken(request.trackingToken),
      publicCode: order.orderCode,
      customerId: order.customerId,
      // Frozen: a later change of an axis, a place or a setting never touches them.
      placeId: order.fee.placeId,
      axisId: order.fee.axisId,
      deliveryFee: order.fee.feeAr,
      feeReason: toFeeReason(order.fee.reason),
      status: "NEW",
      contactName: request.contactName,
      customerNote: request.customerNote ?? null,
      lat: request.location.lat,
      lng: request.location.lng,
      landmarkText: request.landmarkText,
      totalAr: order.totalAr,
      idempotencyKey: order.idempotencyKey,
      createdAt: order.createdAt,
      items: { create: toItemRows(order.lines) },
      events: {
        create: {
          type: "STATUS_CHANGED",
          fromStatus: null,
          toStatus: "NEW",
          actorType: "CUSTOMER",
          actorId: order.customerId,
          payload: {},
          createdAt: order.createdAt,
        },
      },
    },
    select: STORED_ORDER_SELECT,
  });
}
