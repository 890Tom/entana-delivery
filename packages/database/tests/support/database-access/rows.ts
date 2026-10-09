import { randomInt, randomUUID } from "node:crypto";
import type { Client } from "pg";

// Each helper inserts a valid row, so a test only states what it changes.
// An override set to `undefined` is ignored, one set to `null` writes NULL.
export type Overrides = Record<string, unknown>;

async function insert(
  db: Client,
  table: string,
  values: Overrides,
): Promise<Record<string, unknown>> {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  const columns = entries.map(([column]) => `"${column}"`).join(", ");
  const placeholders = entries.map((_, index) => `$${String(index + 1)}`).join(", ");
  const result = await db.query<Record<string, unknown>>(
    `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *`,
    entries.map(([, value]) => value),
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error(`Nothing was inserted into ${table}.`);
  return row;
}

async function insertAndReturnId(db: Client, table: string, values: Overrides): Promise<string> {
  const id = (await insert(db, table, values)).id;
  if (typeof id !== "string") throw new Error(`${table} did not return a UUID id.`);
  return id;
}

function uniqueText(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function randomPhone(): string {
  return `+2613${String(randomInt(100_000_000)).padStart(8, "0")}`;
}

// Same alphabet as the real codes: no ambiguous characters (0, O, 1, I). See docs/data-model.md.
const PUBLIC_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPublicCode(): string {
  return Array.from(
    { length: 6 },
    () => PUBLIC_CODE_ALPHABET[Math.floor(Math.random() * PUBLIC_CODE_ALPHABET.length)],
  ).join("");
}

export function insertCustomer(db: Client, overrides: Overrides = {}): Promise<string> {
  return insertAndReturnId(db, "customer", { phone_e164: randomPhone(), ...overrides });
}

// Inactive by default: an active product must carry a photo (ck_product_photo_when_active).
export function insertProduct(db: Client, overrides: Overrides = {}): Promise<string> {
  return insertAndReturnId(db, "product", {
    sku: uniqueText("sku"),
    name: "Test product",
    price_ar: 1000,
    active: false,
    available: true,
    availability_changed_at: new Date(),
    position: 0,
    ...overrides,
  });
}

export function insertPlace(db: Client, overrides: Overrides = {}): Promise<string> {
  return insertAndReturnId(db, "place", {
    name: uniqueText("place"),
    lat: -18.9,
    lng: 47.5,
    radius_m: 500,
    active: true,
    ...overrides,
  });
}

// A new order by default: no delivery date and no reason are required yet.
export async function insertOrder(db: Client, overrides: Overrides = {}): Promise<string> {
  const customerId = overrides.customer_id ?? (await insertCustomer(db));
  return insertAndReturnId(db, "customer_order", {
    public_token_hash: uniqueText("token-hash"),
    public_code: randomPublicCode(),
    customer_id: customerId,
    delivery_fee: 0,
    fee_reason: "OUT_OF_AXIS",
    status: "NEW",
    contact_name: "Test contact",
    lat: -18.9,
    lng: 47.5,
    landmark_text: "Next to the test landmark",
    total_ar: 0,
    idempotency_key: uniqueText("idempotency"),
    ...overrides,
  });
}

export async function insertOrderItem(db: Client, overrides: Overrides = {}): Promise<string> {
  const orderId = overrides.order_id ?? (await insertOrder(db));
  const productId = overrides.product_id ?? (await insertProduct(db));
  return insertAndReturnId(db, "order_item", {
    order_id: orderId,
    product_id: productId,
    product_name: "Test product",
    qty: 1,
    unit_price: 1000,
    ...overrides,
  });
}

export async function insertOrderEvent(db: Client, overrides: Overrides = {}): Promise<string> {
  const orderId = overrides.order_id ?? (await insertOrder(db));
  return insertAndReturnId(db, "order_event", {
    order_id: orderId,
    type: "STATUS_CHANGED",
    from_status: "NEW",
    to_status: "CONFIRMED",
    actor_type: "SYSTEM",
    payload: {},
    ...overrides,
  });
}

export function insertReseller(db: Client, overrides: Overrides = {}): Promise<string> {
  return insertAndReturnId(db, "reseller", {
    name: "Test reseller",
    area: "Test area",
    landmark_text: "Next to the test landmark",
    lat: -18.9,
    lng: 47.5,
    active: false,
    ...overrides,
  });
}

export function insertStaffUser(db: Client, overrides: Overrides = {}): Promise<string> {
  return insertAndReturnId(db, "staff_user", {
    name: "Test staff",
    username: uniqueText("user"),
    role: "ADMIN",
    password_hash: "not-a-real-hash",
    active: true,
    ...overrides,
  });
}

// The only row of shop_setting has the fixed id 1, which is an integer, not a UUID.
export async function insertShopSetting(db: Client, overrides: Overrides = {}): Promise<void> {
  await insert(db, "shop_setting", {
    id: 1,
    out_of_axis_fee_ar: 0,
    out_of_axis_message: "Test message",
    updated_at: new Date(),
    ...overrides,
  });
}
