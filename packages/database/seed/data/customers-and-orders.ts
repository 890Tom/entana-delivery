import { createHash } from "node:crypto";
import { addDays, localHourOnDay } from "../lib/antananarivo-date.ts";
import type { SeededProduct } from "./catalogue.ts";
import { DEMO_CENTRE, DEMO_OUT_OF_AXIS_FEE_AR, demoPhone } from "./config.ts";
import { computeOrderTotal } from "../lib/order-total.ts";
import type { SeededGeography } from "./places-and-axes.ts";
import type { SeedContext } from "../lib/sql.ts";
import { insertRow, insertRowAndReturnId, minutesBefore, pick } from "../lib/sql.ts";

type Status =
  "NEW" | "CONFIRMED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "REJECTED" | "CANCELLED" | "FAILED";
type FeeReason = "IN_AXIS" | "OUT_OF_AXIS" | "ADJUSTED";
type Actor = "CUSTOMER" | "STAFF" | "SYSTEM";

// What happened to an order, in order. The first step is always the creation.
// `onDeliveryDayAtHour` places a step on the delivery day, at that hour of Antananarivo, so that
// the history never contradicts the delivery date. Without it, the step is dated after creation.
type Step =
  | {
      kind: "status";
      from: Status | null;
      to: Status;
      actor: Actor;
      minutesAfterCreation: number;
      onDeliveryDayAtHour?: number;
      payload?: object;
    }
  | { kind: "fee"; from: number; to: number; actor: Actor; minutesAfterCreation: number };

interface DemoOrder {
  readonly customer: number; // index in DEMO_CUSTOMERS
  // Tracking token and order code: FAKE PUBLIC DEMO VALUES, written here on purpose so that the
  // demo orders can be found again. Real ones are random and secret (only the hash is stored).
  readonly token: string;
  readonly code: string;
  readonly place: number | null; // index of the place, null = no place matches
  readonly axis: string | null; // axis name, null = outside every axis
  readonly feeReason: FeeReason;
  readonly deliveryFee: number;
  readonly status: Status;
  readonly statusReason: string | null;
  // Days from today, null until the order is confirmed.
  readonly deliveryDayOffset: number | null;
  readonly createdMinutesAgo: number;
  readonly items: readonly { readonly product: string; readonly qty: number }[];
  readonly steps: readonly Step[];
}

const DEMO_CUSTOMERS = [
  { phone: demoPhone(101), trustLevel: "KNOWN" },
  { phone: demoPhone(102), trustLevel: "NEW" },
  { phone: demoPhone(103), trustLevel: "NEW" },
  { phone: demoPhone(104), trustLevel: "KNOWN" },
  { phone: demoPhone(105), trustLevel: "NEW" },
] as const;

const DAY = 24 * 60;

// The codes avoid 0, O, 1 and I: see order-code.ts.
const DEMO_ORDERS: readonly DemoOrder[] = [
  {
    customer: 0,
    token: "demo-tracking-token-01",
    code: "DEMA22",
    place: 1,
    axis: "Demo Axis North",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "NEW",
    statusReason: null,
    deliveryDayOffset: null,
    createdMinutesAgo: 120,
    items: [
      { product: "alpha", qty: 2 },
      { product: "beta", qty: 1 },
    ],
    steps: [{ kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 }],
  },
  {
    customer: 1,
    token: "demo-tracking-token-02",
    code: "DEMB33",
    place: null,
    axis: null,
    feeReason: "OUT_OF_AXIS",
    deliveryFee: DEMO_OUT_OF_AXIS_FEE_AR,
    status: "NEW",
    statusReason: null,
    deliveryDayOffset: null,
    createdMinutesAgo: 300,
    items: [{ product: "gamma", qty: 1 }],
    steps: [{ kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 }],
  },
  {
    customer: 2,
    token: "demo-tracking-token-03",
    code: "DEMC44",
    place: 4,
    axis: "Demo Axis East",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "CONFIRMED",
    statusReason: null,
    deliveryDayOffset: 1,
    createdMinutesAgo: DAY,
    items: [
      { product: "beta", qty: 2 },
      { product: "epsilon", qty: 3 },
    ],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "CONFIRMED",
        actor: "STAFF",
        minutesAfterCreation: 90,
        payload: { deliveryDayOffset: 1 },
      },
    ],
  },
  {
    // The admin lowered the flat fee before confirming.
    customer: 3,
    token: "demo-tracking-token-04",
    code: "DEMD55",
    place: null,
    axis: null,
    feeReason: "ADJUSTED",
    deliveryFee: 2000,
    status: "CONFIRMED",
    statusReason: null,
    deliveryDayOffset: 2,
    createdMinutesAgo: 2 * DAY,
    items: [{ product: "alpha", qty: 4 }],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "fee",
        from: DEMO_OUT_OF_AXIS_FEE_AR,
        to: 2000,
        actor: "STAFF",
        minutesAfterCreation: 60,
      },
      {
        kind: "status",
        from: "NEW",
        to: "CONFIRMED",
        actor: "STAFF",
        minutesAfterCreation: 65,
        payload: { deliveryDayOffset: 2 },
      },
    ],
  },
  {
    customer: 0,
    token: "demo-tracking-token-05",
    code: "DEME66",
    place: 8,
    axis: "Demo Axis South",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "OUT_FOR_DELIVERY",
    statusReason: null,
    deliveryDayOffset: 0,
    createdMinutesAgo: 2 * DAY,
    items: [
      { product: "alpha", qty: 1 },
      { product: "epsilon", qty: 2 },
    ],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "CONFIRMED",
        actor: "STAFF",
        minutesAfterCreation: 120,
        payload: { deliveryDayOffset: 0 },
      },
      {
        kind: "status",
        from: "CONFIRMED",
        to: "OUT_FOR_DELIVERY",
        actor: "STAFF",
        minutesAfterCreation: 2 * DAY - 180,
        onDeliveryDayAtHour: 8,
      },
    ],
  },
  {
    customer: 3,
    token: "demo-tracking-token-06",
    code: "DEMF77",
    place: 2,
    axis: "Demo Axis North",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "DELIVERED",
    statusReason: null,
    deliveryDayOffset: -2,
    createdMinutesAgo: 4 * DAY,
    items: [{ product: "gamma", qty: 2 }],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "CONFIRMED",
        actor: "STAFF",
        minutesAfterCreation: 60,
        payload: { deliveryDayOffset: -2 },
      },
      {
        kind: "status",
        from: "CONFIRMED",
        to: "OUT_FOR_DELIVERY",
        actor: "STAFF",
        minutesAfterCreation: 2 * DAY + 480,
        onDeliveryDayAtHour: 8,
      },
      {
        kind: "status",
        from: "OUT_FOR_DELIVERY",
        to: "DELIVERED",
        actor: "STAFF",
        minutesAfterCreation: 2 * DAY + 600,
        onDeliveryDayAtHour: 14,
      },
    ],
  },
  {
    customer: 4,
    token: "demo-tracking-token-07",
    code: "DEMG88",
    place: null,
    axis: null,
    feeReason: "OUT_OF_AXIS",
    deliveryFee: DEMO_OUT_OF_AXIS_FEE_AR,
    status: "REJECTED",
    statusReason: "Demo reason: the address could not be located.",
    deliveryDayOffset: null,
    createdMinutesAgo: 3 * DAY,
    items: [{ product: "beta", qty: 1 }],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "REJECTED",
        actor: "STAFF",
        minutesAfterCreation: 45,
        payload: { reason: "Demo reason: the address could not be located." },
      },
    ],
  },
  {
    customer: 1,
    token: "demo-tracking-token-08",
    code: "DEMH99",
    place: 0,
    axis: "Demo Axis North",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "CANCELLED",
    statusReason: "Demo reason: cancelled at the customer's request.",
    deliveryDayOffset: null,
    createdMinutesAgo: 5 * DAY,
    items: [{ product: "epsilon", qty: 1 }],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "CANCELLED",
        actor: "CUSTOMER",
        minutesAfterCreation: 30,
        payload: { reason: "Demo reason: cancelled at the customer's request." },
      },
    ],
  },
];

// Never in the future: a delivery planned for this morning may be recorded before 08:00 only if
// the seed itself runs earlier, so the time is capped at one minute ago.
function eventTime(
  step: Step,
  createdAt: Date,
  deliveryDayOffset: number | null,
  today: string,
  now: Date,
): Date {
  if (
    step.kind === "status" &&
    step.onDeliveryDayAtHour !== undefined &&
    deliveryDayOffset !== null
  ) {
    const planned = localHourOnDay(addDays(today, deliveryDayOffset), step.onDeliveryDayAtHour);
    return new Date(Math.min(planned.getTime(), now.getTime() - 60_000));
  }
  return new Date(createdAt.getTime() + step.minutesAfterCreation * 60_000);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// A fixed offset from the place (or from the centre, outside every axis): the exact point does
// not matter for the demo, it only has to be near.
function customerPosition(
  geography: SeededGeography,
  order: DemoOrder,
  orderNumber: number,
): { lat: number; lng: number } {
  const nudge = 0.0004 * (orderNumber + 1);
  if (order.place === null) {
    return { lat: DEMO_CENTRE.lat - 0.05 - nudge, lng: DEMO_CENTRE.lng + 0.05 + nudge };
  }
  const place = pick(geography.places, order.place);
  return {
    lat: Number((place.lat + nudge).toFixed(6)),
    lng: Number((place.lng + nudge).toFixed(6)),
  };
}

export async function seedCustomersAndOrders(
  { db, now, today }: SeedContext,
  products: ReadonlyMap<string, SeededProduct>,
  geography: SeededGeography,
  adminId: string,
): Promise<void> {
  const customerIds: string[] = [];
  for (const customer of DEMO_CUSTOMERS) {
    customerIds.push(
      await insertRowAndReturnId(db, "customer", {
        phone_e164: customer.phone,
        trust_level: customer.trustLevel,
      }),
    );
  }

  for (const [orderNumber, order] of DEMO_ORDERS.entries()) {
    const customerId = pick(customerIds, order.customer);
    const createdAt = minutesBefore(now, order.createdMinutesAgo);

    // Name and price are frozen on the item, as for a real order.
    const lines = order.items.map((item) => {
      const product = products.get(item.product);
      if (product === undefined) throw new Error(`Unknown demo product: ${item.product}`);
      return { product, qty: item.qty };
    });
    const totalAr = computeOrderTotal(
      lines.map(({ product, qty }) => ({ qty, unitPrice: product.priceAr })),
      order.deliveryFee,
    );
    const axisId = order.axis === null ? null : (geography.axisIds.get(order.axis) ?? null);
    if (order.axis !== null && axisId === null) throw new Error(`Unknown demo axis: ${order.axis}`);
    const { lat, lng } = customerPosition(geography, order, orderNumber);

    const orderId = await insertRowAndReturnId(db, "customer_order", {
      public_token_hash: sha256Hex(order.token),
      public_code: order.code,
      customer_id: customerId,
      place_id: order.place === null ? null : pick(geography.places, order.place).id,
      axis_id: axisId,
      delivery_fee: order.deliveryFee,
      fee_reason: order.feeReason,
      delivery_date:
        order.deliveryDayOffset === null ? null : addDays(today, order.deliveryDayOffset),
      status: order.status,
      status_reason: order.statusReason,
      contact_name: `Demo Contact ${String(orderNumber + 1)}`,
      customer_note: orderNumber % 2 === 0 ? "Demo note: please call on arrival." : null,
      lat,
      lng,
      landmark_text: `Demo landmark: the fake bakery, order ${String(orderNumber + 1)}`,
      total_ar: totalAr,
      idempotency_key: `demo-idempotency-key-${String(orderNumber + 1).padStart(2, "0")}`,
      created_at: createdAt,
    });

    for (const { product, qty } of lines) {
      await insertRow(db, "order_item", {
        order_id: orderId,
        product_id: product.id,
        product_name: product.name,
        qty,
        unit_price: product.priceAr,
      });
    }

    for (const step of order.steps) {
      const actorId =
        step.actor === "CUSTOMER" ? customerId : step.actor === "STAFF" ? adminId : null;
      const common = {
        order_id: orderId,
        actor_type: step.actor,
        actor_id: actorId,
        created_at: eventTime(step, createdAt, order.deliveryDayOffset, today, now),
      };
      if (step.kind === "status") {
        await insertRow(db, "order_event", {
          ...common,
          type: "STATUS_CHANGED",
          from_status: step.from,
          to_status: step.to,
          payload: JSON.stringify(step.payload ?? {}),
        });
      } else {
        await insertRow(db, "order_event", {
          ...common,
          type: "FEE_ADJUSTED",
          payload: JSON.stringify({ oldFee: step.from, newFee: step.to }),
        });
      }
    }
  }
}
