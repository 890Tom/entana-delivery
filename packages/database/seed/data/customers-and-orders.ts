import { createHash } from "node:crypto";
import type { Client } from "pg";
import { addDays, localHourOnDay } from "../lib/antananarivo-date.ts";
import type { SeededProduct } from "./catalogue.ts";
import { DEMO_CENTRE } from "./config.ts";
import { DEMO_CUSTOMERS, DEMO_ORDERS } from "./demo-orders.ts";
import type { Actor, DemoOrder, Step } from "./demo-orders.ts";
import { computeOrderTotal } from "../lib/order-total.ts";
import type { SeededGeography } from "./places-and-axes.ts";
import type { SeedContext } from "../lib/sql.ts";
import { insertRow, insertRowAndReturnId, minutesBefore, pick } from "../lib/sql.ts";

interface OrderLine {
  readonly product: SeededProduct;
  readonly qty: number;
}

// An order about to be written, with everything resolved from the demo data.
interface PlacedOrder {
  readonly order: DemoOrder;
  readonly orderNumber: number;
  readonly customerId: string;
  readonly createdAt: Date;
  readonly lines: readonly OrderLine[];
}

// Where an event is dated: after the creation, or on the delivery day.
interface EventTiming {
  readonly createdAt: Date;
  readonly deliveryDayOffset: number | null;
  readonly today: string;
  readonly now: Date;
}

// Never in the future: a delivery planned for this morning may be recorded before 08:00 only if
// the seed itself runs earlier, so the time is capped at one minute ago.
function eventTime(step: Step, timing: EventTiming): Date {
  const { createdAt, deliveryDayOffset, today, now } = timing;
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

async function insertCustomers(db: Client): Promise<string[]> {
  const customerIds: string[] = [];
  for (const customer of DEMO_CUSTOMERS) {
    customerIds.push(
      await insertRowAndReturnId(db, "customer", {
        phone_e164: customer.phone,
        trust_level: customer.trustLevel,
      }),
    );
  }
  return customerIds;
}

// Name and price are frozen on the item, as for a real order.
function resolveLines(order: DemoOrder, products: ReadonlyMap<string, SeededProduct>): OrderLine[] {
  return order.items.map((item) => {
    const product = products.get(item.product);
    if (product === undefined) throw new Error(`Unknown demo product: ${item.product}`);
    return { product, qty: item.qty };
  });
}

function resolveAxisId(order: DemoOrder, geography: SeededGeography): string | null {
  if (order.axis === null) return null;
  const axisId = geography.axisIds.get(order.axis);
  if (axisId === undefined) throw new Error(`Unknown demo axis: ${order.axis}`);
  return axisId;
}

async function insertOrderRow(
  { db, today }: SeedContext,
  geography: SeededGeography,
  placed: PlacedOrder,
): Promise<string> {
  const { order, orderNumber, customerId, createdAt, lines } = placed;
  const position = customerPosition(geography, order, orderNumber);
  const sequence = String(orderNumber + 1);
  const totalAr = computeOrderTotal(
    lines.map(({ product, qty }) => ({ qty, unitPrice: product.priceAr })),
    order.deliveryFee,
  );
  return insertRowAndReturnId(db, "customer_order", {
    public_token_hash: sha256Hex(order.token),
    public_code: order.code,
    customer_id: customerId,
    place_id: order.place === null ? null : pick(geography.places, order.place).id,
    axis_id: resolveAxisId(order, geography),
    delivery_fee: order.deliveryFee,
    fee_reason: order.feeReason,
    delivery_date:
      order.deliveryDayOffset === null ? null : addDays(today, order.deliveryDayOffset),
    status: order.status,
    status_reason: order.statusReason,
    contact_name: `Demo Contact ${sequence}`,
    customer_note: orderNumber % 2 === 0 ? "Demo note: please call on arrival." : null,
    lat: position.lat,
    lng: position.lng,
    landmark_text: `Demo landmark: the fake bakery, order ${sequence}`,
    total_ar: totalAr,
    idempotency_key: `demo-idempotency-key-${sequence.padStart(2, "0")}`,
    created_at: createdAt,
  });
}

async function insertOrderItems(
  db: Client,
  orderId: string,
  lines: readonly OrderLine[],
): Promise<void> {
  for (const { product, qty } of lines) {
    await insertRow(db, "order_item", {
      order_id: orderId,
      product_id: product.id,
      product_name: product.name,
      qty,
      unit_price: product.priceAr,
    });
  }
}

function actorId(actor: Actor, customerId: string, adminId: string): string | null {
  if (actor === "CUSTOMER") return customerId;
  return actor === "STAFF" ? adminId : null;
}

// The columns that depend on the kind of event.
function eventDetails(step: Step): Record<string, unknown> {
  if (step.kind === "status") {
    return {
      type: "STATUS_CHANGED",
      from_status: step.from,
      to_status: step.to,
      payload: JSON.stringify(step.payload ?? {}),
    };
  }
  return { type: "FEE_ADJUSTED", payload: JSON.stringify({ oldFee: step.from, newFee: step.to }) };
}

async function insertOrderEvents(
  context: SeedContext,
  placed: PlacedOrder,
  orderId: string,
  adminId: string,
): Promise<void> {
  const { order, customerId, createdAt } = placed;
  const timing: EventTiming = {
    createdAt,
    deliveryDayOffset: order.deliveryDayOffset,
    today: context.today,
    now: context.now,
  };
  for (const step of order.steps) {
    await insertRow(context.db, "order_event", {
      order_id: orderId,
      actor_type: step.actor,
      actor_id: actorId(step.actor, customerId, adminId),
      created_at: eventTime(step, timing),
      ...eventDetails(step),
    });
  }
}

export async function seedCustomersAndOrders(
  context: SeedContext,
  products: ReadonlyMap<string, SeededProduct>,
  geography: SeededGeography,
  adminId: string,
): Promise<void> {
  const customerIds = await insertCustomers(context.db);
  for (const [orderNumber, order] of DEMO_ORDERS.entries()) {
    const placed: PlacedOrder = {
      order,
      orderNumber,
      customerId: pick(customerIds, order.customer),
      createdAt: minutesBefore(context.now, order.createdMinutesAgo),
      lines: resolveLines(order, products),
    };
    const orderId = await insertOrderRow(context, geography, placed);
    await insertOrderItems(context.db, orderId, placed.lines);
    await insertOrderEvents(context, placed, orderId, adminId);
  }
}
