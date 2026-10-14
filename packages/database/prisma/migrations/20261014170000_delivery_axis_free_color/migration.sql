-- The administration chooses the colour of an axis (#rrggbb) instead of a key from 0 to 9, and
-- the number of axes is no longer limited. Existing axes keep the colour their key stood for.
ALTER TABLE "delivery_axis" ADD COLUMN "color" TEXT;

UPDATE "delivery_axis"
   SET "color" = (ARRAY['#2f6b5a', '#9a4a2a', '#7a2e5a', '#7a5a1e', '#2d5b8c',
                        '#a23b3b', '#5b3f8c', '#1f6e78', '#5e6b23', '#4a5260'])["color_key" + 1];

ALTER TABLE "delivery_axis" ALTER COLUMN "color" SET NOT NULL;

ALTER TABLE "delivery_axis"
  ADD CONSTRAINT "ck_delivery_axis_color_format" CHECK ("color" ~ '^#[0-9a-f]{6}$');

-- Dropping the column also drops ck_delivery_axis_color_key_range and delivery_axis_color_key_key.
ALTER TABLE "delivery_axis" DROP COLUMN "color_key";
