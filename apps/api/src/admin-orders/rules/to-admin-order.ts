import type { AdminOrderDetail, AdminOrderSummary, OrderStatus } from "@entana/contracts";

/** What a row of the list is made from. */
export interface StoredOrderSummary {
  readonly id: string;
  readonly publicCode: string;
  readonly status: OrderStatus;
  readonly createdAt: Date;
  readonly deliveryDate: Date | null;
  readonly contactName: string;
  readonly landmarkText: string;
  readonly totalAr: number;
  readonly customer: { readonly phoneE164: string };
  readonly items: readonly { readonly qty: number }[];
}

type EventView = AdminOrderDetail["events"][number];

/** An order as the detail query reads it: only the columns the administration shows. */
export interface StoredAdminOrder extends StoredOrderSummary {
  readonly deliveryFee: number;
  readonly customerNote: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly statusReason: string | null;
  readonly items: readonly {
    readonly productName: string;
    readonly unitPrice: number;
    readonly qty: number;
  }[];
  readonly events: readonly {
    readonly type: EventView["type"];
    readonly fromStatus: OrderStatus | null;
    readonly toStatus: OrderStatus | null;
    readonly createdAt: Date;
    readonly actorType: EventView["actor"]["type"];
    readonly actorId: string | null;
  }[];
}

// A `date` column is read as midnight UTC: its first ten characters are the calendar day as
// stored, with no time zone conversion that could move it.
const toDay = (date: Date | null): string | null =>
  date === null ? null : date.toISOString().slice(0, 10);

export function toAdminOrderSummary(order: StoredOrderSummary): AdminOrderSummary {
  return {
    id: order.id,
    publicCode: order.publicCode,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    deliveryDate: toDay(order.deliveryDate),
    contactName: order.contactName,
    phone: order.customer.phoneE164,
    landmarkText: order.landmarkText,
    totalAr: order.totalAr,
    itemCount: order.items.reduce((total, item) => total + item.qty, 0),
  };
}

export function toAdminOrderDetail(order: StoredAdminOrder): AdminOrderDetail {
  return {
    ...toAdminOrderSummary(order),
    lines: order.items.map((item) => ({
      productName: item.productName,
      unitPriceAr: item.unitPrice,
      quantity: item.qty,
    })),
    deliveryFeeAr: order.deliveryFee,
    customerNote: order.customerNote,
    latitude: order.lat,
    longitude: order.lng,
    // The column also holds a cancellation or a failure reason: only a refusal is a refusal.
    rejectionReason: order.status === "REJECTED" ? order.statusReason : null,
    events: order.events.map((event) => ({
      type: event.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      createdAt: event.createdAt.toISOString(),
      actor: { type: event.actorType, id: event.actorId },
    })),
  };
}
