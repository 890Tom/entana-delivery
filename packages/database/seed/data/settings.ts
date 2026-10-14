import type { SeedContext } from "../lib/sql.ts";

// The migrations create the row with the default values, and a reset empties the table: the
// values are never written here, so the seed shows the defaults of the data model.
export async function seedSettings({ db }: SeedContext): Promise<void> {
  await db.query('INSERT INTO "shop_setting" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING');
}
