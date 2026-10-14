import { describe, expect, it } from "vitest";
import { useRollbackTransaction } from "../support/database-access/database.js";

describe("the settings row created by the migrations", () => {
  const db = useRollbackTransaction();

  it("exists with the default values", async () => {
    const result = await db().query<{
      id: number;
      out_of_axis_fee_ar: number;
      free_delivery_min_pieces: number;
      out_of_axis_message: string;
    }>("SELECT * FROM shop_setting");

    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 1,
        out_of_axis_fee_ar: 4000,
        free_delivery_min_pieces: 20,
        out_of_axis_message:
          "Votre adresse est hors de nos axes de livraison : des frais de livraison s'appliquent.",
      }),
    ]);
  });
});
