import { describe, expect, it } from "vitest";
import { expectViolation, SQLSTATE, useRollbackTransaction } from "../support/database.js";
import { insertOrderItem, insertProduct } from "../support/rows.js";

describe("referential integrity", () => {
  const db = useRollbackTransaction();

  it("refuses to delete a product that an order item still references", async () => {
    const productId = await insertProduct(db());
    await insertOrderItem(db(), { product_id: productId });

    await expectViolation(db().query('DELETE FROM "product" WHERE "id" = $1', [productId]), {
      code: SQLSTATE.restrictViolation,
      constraint: "order_item_product_id_fkey",
    });
  });

  it("deletes a product that no order item references", async () => {
    const productId = await insertProduct(db());

    const result = await db().query('DELETE FROM "product" WHERE "id" = $1', [productId]);

    expect(result.rowCount).toBe(1);
  });
});
