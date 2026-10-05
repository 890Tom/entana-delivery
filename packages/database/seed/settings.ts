import { DEMO_OUT_OF_AXIS_FEE_AR } from "./config.ts";
import type { SeedContext } from "./sql.ts";
import { insertRow } from "./sql.ts";

export async function seedSettings({ db, now }: SeedContext): Promise<void> {
  await insertRow(db, "shop_setting", {
    id: 1,
    out_of_axis_fee_ar: DEMO_OUT_OF_AXIS_FEE_AR,
    out_of_axis_message: "DEMO: delivery outside our usual routes costs a flat fee.",
    updated_at: now,
  });
}
