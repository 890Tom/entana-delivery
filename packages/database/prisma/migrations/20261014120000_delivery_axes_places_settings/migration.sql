-- Delivery axes, places and settings (ADR 0021). Hand-written: it holds CHECK constraints, a
-- deferrable unique constraint and expression indexes, which Prisma cannot generate.
-- Existing orders are not touched: customer_order keeps its delivery_fee, fee_reason and axis_id.

-- place
ALTER TABLE "place"
  ADD CONSTRAINT "ck_place_name_length" CHECK (char_length("name") BETWEEN 1 AND 60),
  ADD CONSTRAINT "ck_place_latitude_range" CHECK ("lat" BETWEEN -90 AND 90),
  ADD CONSTRAINT "ck_place_longitude_range" CHECK ("lng" BETWEEN -180 AND 180);

CREATE UNIQUE INDEX "place_name_lower_key" ON "place" (lower("name"));

-- delivery_axis: "position" becomes "rank", and a colour key is added. Existing axes are
-- renumbered 1..n in the order of their former position, and get the colour keys 0..n-1.
ALTER TABLE "delivery_axis" RENAME COLUMN "position" TO "rank";
ALTER TABLE "delivery_axis" ADD COLUMN "color_key" INTEGER;

UPDATE "delivery_axis" AS axis
   SET "rank" = numbered.row_number, "color_key" = numbered.row_number - 1
  FROM (
    SELECT "id", row_number() OVER (ORDER BY "rank", "id") AS row_number
      FROM "delivery_axis"
  ) AS numbered
 WHERE axis."id" = numbered."id";

ALTER TABLE "delivery_axis" ALTER COLUMN "color_key" SET NOT NULL;

ALTER TABLE "delivery_axis"
  ADD CONSTRAINT "ck_delivery_axis_name_length" CHECK (char_length("name") BETWEEN 1 AND 60),
  ADD CONSTRAINT "ck_delivery_axis_rank_positive" CHECK ("rank" >= 1),
  ADD CONSTRAINT "ck_delivery_axis_color_key_range" CHECK ("color_key" BETWEEN 0 AND 9),
  ADD CONSTRAINT "delivery_axis_rank_key" UNIQUE ("rank") DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT "delivery_axis_color_key_key" UNIQUE ("color_key");

DROP INDEX "delivery_axis_name_key";
CREATE UNIQUE INDEX "delivery_axis_name_lower_key" ON "delivery_axis" (lower("name"));

-- shop_setting: the defaults of the ADR, the new threshold, and the row itself.
ALTER TABLE "shop_setting" ADD COLUMN "free_delivery_min_pieces" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "shop_setting" ALTER COLUMN "out_of_axis_fee_ar" SET DEFAULT 4000;
ALTER TABLE "shop_setting" ALTER COLUMN "out_of_axis_message"
  SET DEFAULT 'Votre adresse est hors de nos axes de livraison : des frais de livraison s''appliquent.';
ALTER TABLE "shop_setting" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "shop_setting"
  ADD CONSTRAINT "ck_shop_setting_free_delivery_min_pieces" CHECK ("free_delivery_min_pieces" >= 1),
  ADD CONSTRAINT "ck_shop_setting_message_length"
    CHECK (char_length(btrim("out_of_axis_message")) BETWEEN 1 AND 200);

-- An existing row keeps its values.
INSERT INTO "shop_setting" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
