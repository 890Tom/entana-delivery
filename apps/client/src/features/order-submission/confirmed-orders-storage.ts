import {
  createOrderResponseSchema,
  createOrderRequestSchema,
  orderCodeSchema,
} from "@entana/contracts";

export const CONFIRMED_ORDERS_STORAGE_KEY = "entana.orders.v1";
/** How long the browser keeps a confirmed order: a value to confirm with the shop. */
export const CONFIRMED_ORDER_RETENTION_DAYS = 30;

const STORAGE_VERSION = 1;
const MAX_ORDERS = 10;
// Ten entries of about 100 bytes: anything near this size was not written by this application.
const MAX_STORED_LENGTH = 4096;
const DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY_KEYS = ["code", "token", "createdAt"] as const;
const TOKEN_SCHEMA = createOrderRequestSchema.shape.trackingToken;
const CREATED_AT_SCHEMA = createOrderResponseSchema.shape.createdAt;

/** What is kept of a confirmed order: enough to find it again, and no personal data. */
export interface ConfirmedOrder {
  readonly code: string;
  readonly token: string;
  readonly createdAt: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toOrder(value: unknown): ConfirmedOrder | null {
  if (!isRecord(value) || Object.keys(value).length !== ENTRY_KEYS.length) {
    return null;
  }
  const code = orderCodeSchema.safeParse(value.code);
  const token = TOKEN_SCHEMA.safeParse(value.token);
  const createdAt = CREATED_AT_SCHEMA.safeParse(value.createdAt);
  return code.success && token.success && createdAt.success
    ? { code: code.data, token: token.data, createdAt: createdAt.data }
    : null;
}

/** Untrusted text: bounded, strictly validated, and an empty list at the first doubt. */
function readOrders(): readonly ConfirmedOrder[] {
  try {
    const stored = window.localStorage.getItem(CONFIRMED_ORDERS_STORAGE_KEY);
    if (stored === null || stored.length > MAX_STORED_LENGTH) {
      return [];
    }
    const content: unknown = JSON.parse(stored);
    if (!isRecord(content) || Object.keys(content).length !== 2) {
      return [];
    }
    const { version, orders } = content;
    if (version !== STORAGE_VERSION || !Array.isArray(orders)) {
      return [];
    }
    const entries = orders.map(toOrder);
    return entries.every((entry) => entry !== null) ? entries : [];
  } catch {
    return [];
  }
}

function writeOrders(orders: readonly ConfirmedOrder[]): void {
  try {
    window.localStorage.setItem(
      CONFIRMED_ORDERS_STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, orders }),
    );
  } catch {
    // Quota or private browsing: the order was created all the same.
  }
}

const isFresh = (order: ConfirmedOrder, nowMs: number): boolean =>
  nowMs - Date.parse(order.createdAt) <= CONFIRMED_ORDER_RETENTION_DAYS * DAY_MS;

/** Puts the order first, and keeps the ten most recent that are not expired. */
export function addConfirmedOrder(order: ConfirmedOrder, nowMs: number): void {
  const kept = readOrders().filter((entry) => isFresh(entry, nowMs));
  writeOrders([order, ...kept].slice(0, MAX_ORDERS));
}

export function removeExpiredConfirmedOrders(nowMs: number): void {
  const orders = readOrders();
  const kept = orders.filter((entry) => isFresh(entry, nowMs));
  if (kept.length !== orders.length) {
    writeOrders(kept);
  }
}
