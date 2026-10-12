import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import {
  expectViolation,
  SQLSTATE,
  useRollbackTransaction,
} from "../support/database-access/database.js";
import {
  insertAdminSession,
  insertCustomer,
  insertOrder,
  insertOrderEvent,
  insertProduct,
  insertStaffUser,
} from "../support/database-access/rows.js";

interface UniqueKeyCase {
  name: string;
  constraint: string;
  insertTwiceWithTheSameValue: (db: Client) => Promise<void>;
}

const uniqueKeyCases: UniqueKeyCase[] = [
  {
    name: "the phone number of a customer",
    constraint: "customer_phone_e164_key",
    insertTwiceWithTheSameValue: async (db) => {
      await insertCustomer(db, { phone_e164: "+261340000001" });
      await insertCustomer(db, { phone_e164: "+261340000001" });
    },
  },
  {
    name: "the idempotency key of an order",
    constraint: "customer_order_idempotency_key_key",
    insertTwiceWithTheSameValue: async (db) => {
      await insertOrder(db, { idempotency_key: "same-key" });
      await insertOrder(db, { idempotency_key: "same-key" });
    },
  },
  {
    name: "the public code of an order",
    constraint: "customer_order_public_code_key",
    insertTwiceWithTheSameValue: async (db) => {
      await insertOrder(db, { public_code: "ABC234" });
      await insertOrder(db, { public_code: "ABC234" });
    },
  },
  {
    name: "the tracking token hash of an order",
    constraint: "customer_order_public_token_hash_key",
    insertTwiceWithTheSameValue: async (db) => {
      await insertOrder(db, { public_token_hash: "same-hash" });
      await insertOrder(db, { public_token_hash: "same-hash" });
    },
  },
  {
    name: "the SKU of a product",
    constraint: "product_sku_key",
    insertTwiceWithTheSameValue: async (db) => {
      await insertProduct(db, { sku: "SAME-SKU" });
      await insertProduct(db, { sku: "SAME-SKU" });
    },
  },
  {
    name: "the username of a staff member",
    constraint: "staff_user_username_key",
    insertTwiceWithTheSameValue: async (db) => {
      await insertStaffUser(db, { username: "same-user" });
      await insertStaffUser(db, { username: "same-user" });
    },
  },
  {
    name: "the e-mail of a staff member",
    constraint: "staff_user_email_key",
    insertTwiceWithTheSameValue: async (db) => {
      await insertStaffUser(db, { email: "same@example.mg" });
      await insertStaffUser(db, { email: "same@example.mg" });
    },
  },
  {
    name: "the token hash of an admin session",
    constraint: "admin_session_token_hash_key",
    insertTwiceWithTheSameValue: async (db) => {
      const hash = "a".repeat(64);
      await insertAdminSession(db, { token_hash: hash });
      await insertAdminSession(db, { token_hash: hash });
    },
  },
  {
    name: "the client event id of an order event",
    constraint: "order_event_client_event_id_key",
    insertTwiceWithTheSameValue: async (db) => {
      const orderId = await insertOrder(db);
      const clientEventId = randomUUID();
      await insertOrderEvent(db, { order_id: orderId, client_event_id: clientEventId });
      await insertOrderEvent(db, { order_id: orderId, client_event_id: clientEventId });
    },
  },
];

describe("unique keys that carry business rules", () => {
  const db = useRollbackTransaction();

  it.each(uniqueKeyCases)(
    "refuses a second row with the same value for $name",
    async ({ constraint, insertTwiceWithTheSameValue }) => {
      await expectViolation(insertTwiceWithTheSameValue(db()), {
        code: SQLSTATE.uniqueViolation,
        constraint,
      });
    },
  );

  it("allows several order events without a client event id", async () => {
    const orderId = await insertOrder(db());

    await insertOrderEvent(db(), { order_id: orderId, client_event_id: null });
    await insertOrderEvent(db(), { order_id: orderId, client_event_id: null });

    const result = await db().query<{ count: string }>(
      "SELECT count(*) FROM order_event WHERE order_id = $1",
      [orderId],
    );
    expect(result.rows[0]?.count).toBe("2");
  });
});
