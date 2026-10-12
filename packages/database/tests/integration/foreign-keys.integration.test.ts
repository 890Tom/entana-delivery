import { describe, expect, it } from "vitest";
import { assertThrowawayDatabase } from "../support/throwaway-database/assert-throwaway-database.js";
import {
  expectViolation,
  SQLSTATE,
  useRollbackTransaction,
} from "../support/database-access/database.js";
import {
  insertAdminSession,
  insertOrderItem,
  insertProduct,
  insertStaffUser,
} from "../support/database-access/rows.js";

describe("referential integrity", () => {
  const db = useRollbackTransaction();

  it("refuses to delete a product that an order item still references", async () => {
    const productId = await insertProduct(db());
    await insertOrderItem(db(), { product_id: productId });

    await assertThrowawayDatabase(db());
    await expectViolation(db().query('DELETE FROM "product" WHERE "id" = $1', [productId]), {
      code: SQLSTATE.restrictViolation,
      constraint: "order_item_product_id_fkey",
    });
  });

  it("deletes a product that no order item references", async () => {
    const productId = await insertProduct(db());

    await assertThrowawayDatabase(db());
    const result = await db().query('DELETE FROM "product" WHERE "id" = $1', [productId]);

    expect(result.rowCount).toBe(1);
  });

  it("refuses to delete a staff account that a session still references", async () => {
    const staffUserId = await insertStaffUser(db());
    await insertAdminSession(db(), { staff_user_id: staffUserId });

    await assertThrowawayDatabase(db());
    await expectViolation(db().query('DELETE FROM "staff_user" WHERE "id" = $1', [staffUserId]), {
      code: SQLSTATE.restrictViolation,
      constraint: "admin_session_staff_user_id_fkey",
    });
  });
});
